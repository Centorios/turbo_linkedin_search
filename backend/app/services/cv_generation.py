from typing import Any
import hashlib
import json

from pydantic import ValidationError

from app.models.cv import StructuredCv
from app.models.generate_cv import GenerateCvResponse
from app.models.profile_certificate import CertificateMergeReport
from app.services.azure_openai import AzureOpenAIError, AzureOpenAIProvider
from app.services.language_detection import detect_language
from app.services.profile_repository import ProfileRepository
from app.services.resume_repository import ResumeRepository
from app.services.certificate_merge import merge_selected_certificates
from app.services.profile_certificate_service import ProfileCertificateService


class InvalidGeneratedCvError(Exception):
    pass


class GenerationIdempotencyConflictError(Exception):
    pass


class CvGenerationService:
    def __init__(
        self,
        provider: AzureOpenAIProvider | None = None,
        repository: ResumeRepository | None = None,
        profile_repository: ProfileRepository | None = None,
        certificate_service: ProfileCertificateService | None = None,
    ) -> None:
        self.provider = provider or AzureOpenAIProvider()
        self.repository = repository or ResumeRepository()
        self.profile_repository = profile_repository
        self.certificate_service = certificate_service

    async def generate(self, user_id: str, request_id: str, text: str,
                       selected_certificate_ids: list[str] | None = None) -> GenerateCvResponse:
        ids = selected_certificate_ids or []
        fingerprint = hashlib.sha256(json.dumps({"text": text, "selectedCertificateIds": ids},
                                                sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        existing = self.repository.get_by_request(user_id, request_id)
        if existing:
            if existing.get("request_fingerprint") and existing["request_fingerprint"] != fingerprint:
                raise GenerationIdempotencyConflictError()
            return self._response(existing)

        profile = self.profile_repository.get_by_user(user_id) if self.profile_repository else None
        selected = (self.certificate_service or ProfileCertificateService()).selected(user_id, ids) if ids else []

        try:
            generated = await self.provider.generate_cv(text)
        except AzureOpenAIError:
            raise

        document = self._with_detected_language(
            self._with_profile(self._validate(generated), profile), text
        )
        document, report = merge_selected_certificates(document, selected)
        try:
            saved = self.repository.create(user_id, request_id, document.model_dump(), fingerprint, report.model_dump())
        except Exception:
            existing = self.repository.get_by_request(user_id, request_id)
            if existing:
                if existing.get("request_fingerprint") and existing["request_fingerprint"] != fingerprint:
                    raise GenerationIdempotencyConflictError()
                return self._response(existing)
            raise
        return self._response(saved)

    @classmethod
    def _response(cls, row: dict[str, Any]) -> GenerateCvResponse:
        return GenerateCvResponse.model_validate({**cls._validate(row["data"]).model_dump(),
            "certificateMergeReport": row.get("certificate_merge_report") or CertificateMergeReport().model_dump()})

    @classmethod
    def _with_detected_language(cls, document: StructuredCv, text: str) -> StructuredCv:
        """When the text names no spoken language, lists the one it is written in.

        The level is left empty: writing in a language says nothing about proficiency.
        A language the AI already found is never replaced, and an unclear text adds nothing.
        """
        if document.languages:
            return document
        detected = detect_language(text)
        if detected is None:
            return document
        data = document.model_dump()
        data["languages"] = [{"name": detected, "proficiency": ""}]
        return cls._validate(data)

    @classmethod
    def _with_profile(
        cls,
        document: StructuredCv,
        profile: dict[str, str | None] | None,
    ) -> StructuredCv:
        if profile is None:
            return document
        data = document.model_dump()
        for field in ("fullName", "email", "phone", "location", "linkedin", "website"):
            value = profile[field]
            if value:
                data["personalInfo"][field] = value
        data["personalInfo"]["photoPath"] = profile.get("photoPath")
        return cls._validate(data)

    @staticmethod
    def _validate(data: dict[str, Any]) -> StructuredCv:
        try:
            return StructuredCv.model_validate(data)
        except (ValidationError, TypeError) as exc:
            raise InvalidGeneratedCvError("Generated CV does not match the contract") from exc
