from datetime import datetime
import re
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.models.cv import StrictModel

Affinity = Literal["Alta", "Media"]
PROHIBITED_AFFINITY_TEXT = re.compile(
    r"%|\b(?:porcentaje|porcentajes|percentage|percent|probabilidad|probability)\b"
    r"|\b\d+(?:[.,]\d+)?\s*(?:por ciento|percent)\b",
    re.IGNORECASE,
)


class MatchRequest(StrictModel):
    searchId: UUID
    resumeId: UUID
    recalculate: bool = False


class LlmRecommendation(StrictModel):
    offerId: str
    affinity: Affinity
    summary: str = Field(min_length=1, max_length=600)
    matches: list[str] = Field(default_factory=list, max_length=8)
    unmetRequirements: list[str] = Field(default_factory=list, max_length=8)
    missingInfo: list[str] = Field(default_factory=list, max_length=8)

    @model_validator(mode="after")
    def reject_numeric_or_hiring_probability(self) -> "LlmRecommendation":
        user_visible_text = [
            self.summary,
            *self.matches,
            *self.unmetRequirements,
            *self.missingInfo,
        ]
        if any(PROHIBITED_AFFINITY_TEXT.search(text) for text in user_visible_text):
            raise ValueError("No se permiten porcentajes ni probabilidades de contratación")
        return self


class LlmMatchOutput(StrictModel):
    recommendations: list[LlmRecommendation] = Field(default_factory=list, max_length=3)

    @field_validator("recommendations")
    @classmethod
    def unique_offers(cls, value: list[LlmRecommendation]) -> list[LlmRecommendation]:
        ids = [item.offerId for item in value]
        if len(ids) != len(set(ids)):
            raise ValueError("offerId duplicado")
        return value


class MatchRecommendation(StrictModel):
    rank: int = Field(ge=1, le=3)
    offerId: str
    title: str
    company: str
    location: str
    url: str
    affinity: Affinity
    summary: str
    matches: list[str]
    unmetRequirements: list[str]
    missingInfo: list[str]


class MatchResult(StrictModel):
    resumeChanged: bool
    completedAt: datetime
    recommendations: list[MatchRecommendation] = Field(max_length=3)
