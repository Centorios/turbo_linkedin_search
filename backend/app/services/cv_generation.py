from typing import Any

from pydantic import ValidationError

from app.models.cv import StructuredCv
from app.services.azure_openai import AzureOpenAIError, AzureOpenAIProvider
from app.services.profile_repository import ProfileRepository
from app.services.resume_repository import ResumeRepository


class InvalidGeneratedCvError(Exception):
    pass


class CvGenerationService:
    def __init__(
        self,
        provider: AzureOpenAIProvider | None = None,
        repository: ResumeRepository | None = None,
        profile_repository: ProfileRepository | None = None,
    ) -> None:
        self.provider = provider or AzureOpenAIProvider()
        self.repository = repository or ResumeRepository()
        self.profile_repository = profile_repository

    async def generate(self, user_id: str, request_id: str, text: str) -> StructuredCv:
        profile = self.profile_repository.get_by_user(user_id) if self.profile_repository else None
        existing = self.repository.get_by_request(user_id, request_id)
        if existing:
            return self._with_profile(self._validate(existing["data"]), profile)

        try:
            generated = await self.provider.generate_cv(text)
        except AzureOpenAIError:
            raise

        document = self._with_profile(self._validate(generated), profile)
        try:
            saved = self.repository.create(user_id, request_id, document.model_dump())
        except Exception:
            existing = self.repository.get_by_request(user_id, request_id)
            if existing:
                return self._validate(existing["data"])
            raise
        return self._validate(saved["data"])

    @classmethod
    def _with_profile(cls, document: StructuredCv, profile: dict[str, str] | None) -> StructuredCv:
        if profile is None:
            return document
        data = document.model_dump()
        for field in ("fullName", "email", "phone", "location", "linkedin", "website"):
            value = profile[field]
            if value:
                data["personalInfo"][field] = value
        return cls._validate(data)

    @staticmethod
    def _validate(data: dict[str, Any]) -> StructuredCv:
        try:
            return StructuredCv.model_validate(data)
        except (ValidationError, TypeError) as exc:
            raise InvalidGeneratedCvError("Generated CV does not match the contract") from exc