import logging
import hashlib
import json
import re
from io import BytesIO
from typing import Any
from urllib.parse import unquote
from uuid import uuid4

from pydantic import ValidationError
from pypdf import PdfReader
from pypdf.errors import PyPdfError

from app.models.cv import StructuredCv
from app.models.cv_import import (
    CvImportResponse,
    CvSource,
    EditNeedsInput,
    EditReady,
    EditRequest,
    ResumeEditRequest,
    ResumeVersion,
    SaveVersionRequest,
)
from app.services.azure_openai import AzureOpenAIError, AzureOpenAIProvider
from app.services.cv_import_repository import CvImportRepository
from app.services.certificate_merge import merge_selected_certificates
from app.services.profile_certificate_service import ProfileCertificateService
from app.services.cv_photo import validate_cv_photo


logger = logging.getLogger(__name__)
MAX_PDF_BYTES = 10 * 1024 * 1024
MAX_PDF_PAGES = 20
MAX_FILENAME_HEADER_LENGTH = 3060
_PERCENT_ESCAPE = re.compile(r"%(?![0-9A-Fa-f]{2})")
_SECTION_LABELS = {
    "personalInfo": "información personal",
    "summary": "resumen",
    "experience": "experiencia",
    "education": "educación",
    "skills": "habilidades",
    "languages": "idiomas",
    "certifications": "certificaciones",
}


class InvalidPdfError(Exception):
    pass


class InvalidCvImportResponseError(Exception):
    pass


class CvSourceNotFoundError(Exception):
    pass


class NoChangesError(Exception):
    pass


def extract_pdf_content(document: bytes) -> tuple[str, int]:
    if not document:
        raise InvalidPdfError("El PDF está vacío")
    if len(document) > MAX_PDF_BYTES:
        raise InvalidPdfError("El archivo supera el límite de 10 MiB")
    if not document.startswith(b"%PDF-"):
        raise InvalidPdfError("El archivo no tiene una firma PDF válida")

    try:
        reader = PdfReader(BytesIO(document), strict=False)
        if reader.is_encrypted:
            raise InvalidPdfError("No se admiten PDFs protegidos por contraseña")
        page_count = len(reader.pages)
        if page_count < 1:
            raise InvalidPdfError("El PDF no contiene páginas")
        if page_count > MAX_PDF_PAGES:
            raise InvalidPdfError("El PDF supera el límite de 20 páginas")
        text = " ".join(
            extracted.strip()
            for page in reader.pages
            if (extracted := page.extract_text() or "").strip()
        )
    except InvalidPdfError:
        raise
    except (PyPdfError, OSError, ValueError, EOFError, RecursionError) as exc:
        raise InvalidPdfError("No se pudo leer el PDF") from exc
    if not text.strip():
        raise InvalidPdfError("El PDF no contiene texto extraíble")
    return text, page_count


def extract_pdf_text(document: bytes) -> str:
    return extract_pdf_content(document)[0]


def decode_original_filename(value: str) -> str:
    if len(value) > MAX_FILENAME_HEADER_LENGTH or _PERCENT_ESCAPE.search(value):
        raise InvalidPdfError("El nombre del archivo no es válido")
    try:
        decoded = unquote(value, errors="strict")
    except UnicodeDecodeError as exc:
        raise InvalidPdfError("El nombre del archivo no es UTF-8 válido") from exc
    filename = decoded.replace("\\", "/").rsplit("/", 1)[-1].strip()
    filename = "".join(char for char in filename if ord(char) >= 32 and ord(char) != 127)
    if not filename or filename in {".", ".."} or len(filename) > 255:
        raise InvalidPdfError("El nombre del archivo no es válido")
    return filename


class CvImportService:
    def __init__(
        self,
        provider: AzureOpenAIProvider | None = None,
        repository: CvImportRepository | None = None,
    ) -> None:
        self.provider = provider or AzureOpenAIProvider()
        self.repository = repository or CvImportRepository()

    async def import_pdf(
        self,
        user_id: str,
        request_id: str,
        filename: str,
        file_bytes: bytes,
    ) -> CvImportResponse:
        existing = self.repository.get_import_by_request(user_id, request_id)
        if existing:
            return self._import_response(existing)

        text, page_count = extract_pdf_content(file_bytes)
        try:
            generated = await self.provider.generate_cv(text)
            document = StructuredCv.model_validate(generated)
        except ValidationError as exc:
            logger.warning("cv_import_invalid_generated_cv", extra={"issues": len(exc.errors())})
            raise InvalidCvImportResponseError("Generated CV did not match StructuredCv") from exc
        except AzureOpenAIError:
            raise

        record = self.repository.create_import(
            user_id=user_id,
            request_id=request_id,
            source_id=str(uuid4()),
            filename=filename,
            file_bytes=file_bytes,
            page_count=page_count,
            data=document.model_dump(),
        )
        return self._import_response(record)

    async def propose_edit(self, user_id: str, source_id: str, request: EditRequest) -> EditNeedsInput | EditReady:
        source_id = str(source_id)
        source = self.repository.get_source(user_id, source_id)
        base = self.repository.get_resume(user_id, str(request.baseResumeId))
        if source is None or base is None or base.get("source_id") != source_id:
            raise CvSourceNotFoundError("CV source not found")

        base_cv = self._validate_cv(base.get("data"))
        return await self._propose_changes(request.currentCv or base_cv, request.instruction, request.answers)

    async def propose_resume_edit(
        self, user_id: str, resume_id: str, request: ResumeEditRequest
    ) -> EditNeedsInput | EditReady:
        """Same edit flow, starting from any version in the person's history."""
        base = self.repository.get_resume(user_id, str(resume_id))
        if base is None:
            raise CvSourceNotFoundError("Resume not found")
        base_cv = self._validate_cv(base.get("data"))
        return await self._propose_changes(request.currentCv or base_cv, request.instruction, request.answers)

    async def _propose_changes(
        self, edit_base: StructuredCv, instruction: str, answers: list[str]
    ) -> EditNeedsInput | EditReady:
        try:
            result = await self.provider.edit_cv(edit_base.model_dump(), instruction, answers)
            if result.get("status") == "needs_input":
                return EditNeedsInput.model_validate(result)
            if result.get("status") != "ready":
                raise InvalidCvImportResponseError("CV edit response has an invalid status")
            proposed = self._validate_cv(result.get("proposedCv"))
            proposed_data = proposed.model_dump()
            proposed_data["personalInfo"]["photoPath"] = edit_base.personalInfo.photoPath
            proposed = self._validate_cv(proposed_data)
        except (ValidationError, AttributeError, TypeError) as exc:
            raise InvalidCvImportResponseError("CV edit response did not match its contract") from exc
        except AzureOpenAIError:
            raise

        base_data = edit_base.model_dump()
        proposed_data = proposed.model_dump()
        changed = [key for key in base_data if base_data[key] != proposed_data[key]]
        summary = (
            "Se proponen cambios en " + ", ".join(_SECTION_LABELS[key] for key in changed) + "."
            if changed
            else "La propuesta no contiene cambios respecto de la versión actual."
        )
        return EditReady(
            status="ready",
            proposedCv=proposed,
            changedSections=changed,
            changeSummary=summary,
        )

    def save_version(
        self,
        user_id: str,
        source_id: str,
        request_id: str,
        request: SaveVersionRequest,
    ) -> ResumeVersion:
        source_id = str(source_id)
        source = self.repository.get_source(user_id, source_id)
        base = self.repository.get_resume(user_id, str(request.baseResumeId))
        if source is None or base is None or base.get("source_id") != source_id:
            raise CvSourceNotFoundError("CV source not found")
        return self._save_version(user_id, source_id, request_id, base, request.data,
                                  [str(value) for value in request.selectedCertificateIds])

    def save_resume_version(
        self, user_id: str, resume_id: str, request_id: str, data: StructuredCv,
        selected_certificate_ids: list[str] | None = None,
    ) -> ResumeVersion:
        """Saves an edited history version as a new version; the base is never overwritten.
        A version of an imported PDF keeps its source."""
        base = self.repository.get_resume(user_id, str(resume_id))
        if base is None:
            raise CvSourceNotFoundError("Resume not found")
        source_id = base.get("source_id")
        return self._save_version(user_id, str(source_id) if source_id else None,
                                  request_id, base, data, selected_certificate_ids or [])

    def _save_version(self, user_id: str, source_id: str | None, request_id: str,
                      base: dict[str, Any], data: StructuredCv,
                      selected_certificate_ids: list[str]) -> ResumeVersion:
        fingerprint = hashlib.sha256(json.dumps({"base": base["id"], "data": data.model_dump(),
            "selectedCertificateIds": selected_certificate_ids}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        if hasattr(self.repository, "get_version_by_request"):
            existing = self.repository.get_version_by_request(user_id, request_id)
            if existing:
                if existing.get("request_fingerprint") and existing["request_fingerprint"] != fingerprint:
                    raise ValueError("Idempotency key was already used for a different version")
                return self._resume_version(existing, source_id)
        selected = (ProfileCertificateService().selected(user_id, selected_certificate_ids)
                    if selected_certificate_ids else [])
        merged, report = merge_selected_certificates(data, selected)
        previous = self._validate_cv(base["data"])
        new_photo = merged.personalInfo.photoPath
        if new_photo != previous.personalInfo.photoPath:
            validate_cv_photo(user_id, new_photo)
        if merged.model_dump() == previous.model_dump():
            raise NoChangesError()
        saved = self.repository.create_version(
            user_id=user_id, source_id=source_id, request_id=request_id,
            parent_resume_id=str(base["id"]), data=merged.model_dump(),
            request_fingerprint=fingerprint, certificate_merge_report=report.model_dump(),
        )
        return self._resume_version(saved, source_id)

    def download_source(self, user_id: str, source_id: str) -> tuple[bytes, str]:
        result = self.repository.download_source(user_id, str(source_id))
        if result is None:
            raise CvSourceNotFoundError("CV source not found")
        return result

    def delete_source(self, user_id: str, source_id: str) -> bool:
        if not self.repository.delete_source(user_id, str(source_id)):
            raise CvSourceNotFoundError("CV source not found")
        return True

    @classmethod
    def _import_response(cls, record: dict[str, Any]) -> CvImportResponse:
        source = record["source"]
        resume = record["resume"]
        return CvImportResponse(
            source=CvSource(
                id=source["id"],
                originalFilename=source.get("original_filename", source.get("originalFilename")),
                fileSizeBytes=source.get("file_size_bytes", source.get("fileSizeBytes")),
                pageCount=source.get("page_count", source.get("pageCount")),
                createdAt=source.get("created_at", source.get("createdAt")),
            ),
            resume=cls._resume_version(resume, source["id"]),
        )

    @staticmethod
    def _resume_version(row: dict[str, Any], source_id: str | None) -> ResumeVersion:
        return ResumeVersion(
            id=row["id"],
            sourceId=source_id,
            parentResumeId=row.get("parent_resume_id", row.get("parentResumeId")),
            createdAt=row.get("created_at", row.get("createdAt")),
            data=StructuredCv.model_validate(row["data"]),
            certificateMergeReport=row.get("certificate_merge_report") or {},
        )

    @staticmethod
    def _validate_cv(data: Any) -> StructuredCv:
        try:
            return StructuredCv.model_validate(data)
        except (ValidationError, TypeError) as exc:
            raise InvalidCvImportResponseError("CV data did not match StructuredCv") from exc
