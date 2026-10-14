from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import ConfigDict, Field, field_validator

from app.models.cv import StrictModel


class JobSearchProfile(StrictModel):
    resumeId: UUID
    suggestedKeywords: str
    suggestedLocation: str
    skills: list[str]


MAX_OFFERS_PER_SOURCE = 20
MAX_DESCRIPTION_CHARS = 8000


class JobSource(StrEnum):
    jooble = "jooble"
    linkedin = "linkedin"


class SourceRunStatus(StrEnum):
    pending = "pending"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    timed_out = "timed_out"


class SearchStatus(StrEnum):
    in_progress = "in_progress"
    complete = "complete"
    incomplete = "incomplete"


class JobSearchRequest(StrictModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    resumeId: UUID
    keywords: str = Field(min_length=2, max_length=120)
    location: str = Field(min_length=2, max_length=100)
    sources: list[JobSource] = Field(
        default_factory=lambda: [JobSource.jooble], min_length=1, max_length=2
    )

    @field_validator("sources")
    @classmethod
    def _unique_sources(cls, value: list[JobSource]) -> list[JobSource]:
        return list(dict.fromkeys(value))


class AlternateUrl(StrictModel):
    source: str
    url: str


class JobListing(StrictModel):
    id: str
    title: str
    company: str
    location: str
    snippet: str
    description: str | None = None
    descriptionIsPartial: bool = False
    url: str
    source: str
    sources: list[str] = Field(default_factory=list)
    alternateUrls: list[AlternateUrl] = Field(default_factory=list)
    updatedAt: datetime | None = None

    @field_validator("url")
    @classmethod
    def _https_url(cls, value: str) -> str:
        if not value.startswith("https://"):
            raise ValueError("url must use https")
        return value

    @field_validator("description")
    @classmethod
    def _truncate_description(cls, value: str | None) -> str | None:
        return value[:MAX_DESCRIPTION_CHARS] if value else value


class SourceState(StrictModel):
    source: JobSource
    status: SourceRunStatus
    offersCount: int = 0
    error: str | None = None


class JobSearchResponse(StrictModel):
    items: list[JobListing]
    searchId: str | None = None
    status: SearchStatus | None = None
    sources: list[SourceState] = Field(default_factory=list)


class JobSearchStatusResponse(StrictModel):
    searchId: str
    status: SearchStatus
    sources: list[SourceState]
    items: list[JobListing]
    matchAvailable: bool
    canRecalculate: bool = False
