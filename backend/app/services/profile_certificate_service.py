from __future__ import annotations

import hashlib
from typing import Any
from uuid import uuid4

from pydantic import ValidationError

from app.models.cv import Certification
from app.models.profile_certificate import (
    CertificateExtractionResult, CertificatePage, CertificateReviewRequest,
    ProfileCertificate,
)
from app.services.azure_openai import AzureOpenAIProvider
from app.services.certificate_extraction import extract_input
from app.services.certificate_merge import equivalent, normalize
from app.services.profile_certificate_repository import ProfileCertificateRepository, CertificateRegistrationConflictError


class CertificateNotFoundError(Exception):
    pass


class CertificateConflictError(Exception):
    pass


class CertificateLimitError(Exception):
    pass


class InvalidCertificateExtractionError(Exception):
    pass


def public_certificate(row: dict[str, Any], duplicate: bool = False) -> ProfileCertificate:
    return ProfileCertificate(
        id=row["id"], originalFilename=row["original_filename"],
        mimeType=row["mime_type"], fileSizeBytes=row["file_size_bytes"],
        status=row["status"], certification=Certification(
            name=row["name"], issuer=row["issuer"], issueDate=row["issue_date"],
            expirationDate=row["expiration_date"], credential=row["credential"],
        ),
        language={"name": row["language_name"], "proficiency": row["language_proficiency"]}
        if row.get("language_name") else None,
        createdAt=row["created_at"], duplicate=duplicate,
    )


class ProfileCertificateService:
    def __init__(self, provider: AzureOpenAIProvider | None = None,
                 repository: ProfileCertificateRepository | None = None) -> None:
        self.provider = provider or AzureOpenAIProvider()
        self.repository = repository or ProfileCertificateRepository()

    def list(self, user_id: str, offset: int, limit: int) -> CertificatePage:
        rows = self.repository.list(user_id, offset, limit)
        return CertificatePage(items=[public_certificate(row) for row in rows[:limit]],
                               offset=offset, limit=limit, hasMore=len(rows) > limit)

    def get(self, user_id: str, certificate_id: str) -> ProfileCertificate:
        row = self.repository.get(user_id, certificate_id)
        if row is None:
            raise CertificateNotFoundError()
        return public_certificate(row)

    def selected(self, user_id: str, ids: list[str]) -> list[dict[str, Any]]:
        if len(ids) != len(set(ids)) or len(ids) > 50:
            raise InvalidCertificateExtractionError("Seleccioná hasta 50 certificados distintos")
        selected = []
        for certificate_id in ids:
            row = self.repository.get(user_id, certificate_id)
            if row is None or row["status"] != "ready":
                raise InvalidCertificateExtractionError("Un certificado seleccionado no está disponible")
            item = public_certificate(row)
            selected.append({"id": str(item.id), "certification": item.certification,
                             "language": item.language})
        return selected

    async def upload(self, user_id: str, request_id: str, filename: str,
                     mime_type: str, content: bytes) -> ProfileCertificate:
        digest = hashlib.sha256(content).hexdigest()
        existing = self.repository.get_by_request(user_id, request_id)
        if existing:
            if existing["content_sha256"] != digest:
                raise CertificateConflictError()
            return public_certificate(existing, duplicate=True)
        existing = self.repository.get_by_hash(user_id, digest)
        if existing:
            return public_certificate(existing, duplicate=True)
        text, image = extract_input(content, mime_type)
        try:
            extracted = CertificateExtractionResult.model_validate(
                await self.provider.extract_certificate(text=text, image=image, mime_type=mime_type)
            )
        except (ValidationError, TypeError) as exc:
            raise InvalidCertificateExtractionError("No se pudieron reconocer los datos del certificado") from exc
        existing_rows = self.repository.list(user_id, 0, 50)
        for row in existing_rows:
            if equivalent({"name": row["name"], "issuer": row["issuer"],
                           "issueDate": row["issue_date"], "credential": row["credential"]},
                          extracted.certification.model_dump()):
                return public_certificate(row, duplicate=True)
        if len(existing_rows) >= 50:
            raise CertificateLimitError()
        certificate_id = str(uuid4())
        extension = {"application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png"}[mime_type]
        details = extracted.certification
        record = {
            "id": certificate_id, "user_id": user_id, "request_id": request_id,
            "storage_path": f"{user_id}/{certificate_id}.{extension}",
            "original_filename": filename, "mime_type": mime_type,
            "file_size_bytes": len(content), "content_sha256": digest,
            "status": "pending_review" if extracted.needsReview or not details.name.strip() else "ready",
            "name": details.name, "issuer": details.issuer, "issue_date": details.issueDate,
            "expiration_date": details.expirationDate, "credential": details.credential,
            "language_name": extracted.language.name if extracted.language else "",
            "language_proficiency": extracted.language.proficiency if extracted.language else "",
            "normalized_name": normalize(details.name), "normalized_issuer": normalize(details.issuer),
            "normalized_credential": normalize(details.credential),
        }
        try:
            saved, duplicate = self.repository.create(record, content)
        except CertificateRegistrationConflictError as exc:
            raise CertificateConflictError() from exc
        except Exception as exc:
            if "certificate_limit_reached" in str(exc):
                raise CertificateLimitError() from exc
            raise
        return public_certificate(saved, duplicate=duplicate)

    def review(self, user_id: str, certificate_id: str,
               request: CertificateReviewRequest) -> ProfileCertificate:
        row = self.repository.get(user_id, certificate_id)
        if row is None or row["status"] != "pending_review":
            raise CertificateNotFoundError()
        details = request.certification
        if not details.name.strip():
            raise InvalidCertificateExtractionError("Indicá el nombre del certificado")
        for other in self.repository.list(user_id, 0, 50):
            if other["id"] != certificate_id and equivalent(
                {"name": other["name"], "issuer": other["issuer"],
                 "issueDate": other["issue_date"], "credential": other["credential"]},
                details.model_dump(),
            ):
                raise CertificateConflictError()
        values = {
            "status": "ready", "name": details.name, "issuer": details.issuer,
            "issue_date": details.issueDate, "expiration_date": details.expirationDate,
            "credential": details.credential,
            "language_name": request.language.name if request.language else "",
            "language_proficiency": request.language.proficiency if request.language else "",
            "normalized_name": normalize(details.name), "normalized_issuer": normalize(details.issuer),
            "normalized_credential": normalize(details.credential),
        }
        saved = self.repository.update_pending(user_id, certificate_id, values)
        if saved is None:
            raise CertificateNotFoundError()
        return public_certificate(saved)

    def download(self, user_id: str, certificate_id: str) -> tuple[bytes, dict[str, Any]]:
        result = self.repository.download(user_id, certificate_id)
        if result is None:
            raise CertificateNotFoundError()
        return result

    def delete(self, user_id: str, certificate_id: str) -> None:
        if not self.repository.delete(user_id, certificate_id):
            raise CertificateNotFoundError()
