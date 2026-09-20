from typing import Any

from pydantic import ValidationError

from app.models.cv import StructuredCv
from app.services.azure_openai import AzureOpenAIError, AzureOpenAIProvider
from app.services.resume_repository import ResumeRepository


class InvalidGeneratedCvError(Exception):
    pass


class CvGenerationService:
    def __init__(
        self,
        provider: AzureOpenAIProvider | None = None,
        repository: ResumeRepository | None = None,
    ) -> None:
        self.provider = provider or AzureOpenAIProvider()
        self.repository = repository or ResumeRepository()

    async def generate(self, user_id: str, request_id: str, text: str) -> StructuredCv:
        existing = self.repository.get_by_request(user_id, request_id)
        if existing:
            return self._validate(existing["data"])

        try:
            generated = await self.provider.generate_cv(text)
        except AzureOpenAIError:
            raise

        document = self._validate(generated)
        try:
            saved = self.repository.create(user_id, request_id, document.model_dump())
        except Exception:
            existing = self.repository.get_by_request(user_id, request_id)
            if existing:
                return self._validate(existing["data"])
            raise
        return self._validate(saved["data"])

    @staticmethod
    def _validate(data: dict[str, Any]) -> StructuredCv:
        try:
            return StructuredCv.model_validate(data)
        except (ValidationError, TypeError) as exc:
            raise InvalidGeneratedCvError("Generated CV does not match the contract") from exc