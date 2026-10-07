from datetime import datetime
from uuid import UUID

from pydantic import ConfigDict, Field

from app.models.cv import StrictModel


class JobSearchProfile(StrictModel):
    resumeId: UUID
    suggestedKeywords: str
    suggestedLocation: str
    skills: list[str]


class JobSearchRequest(StrictModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    resumeId: UUID
    keywords: str = Field(min_length=2, max_length=120)
    location: str = Field(min_length=2, max_length=100)


class JobListing(StrictModel):
    id: str
    title: str
    company: str
    location: str
    snippet: str
    url: str
    source: str
    updatedAt: datetime | None = None


class JobSearchResponse(StrictModel):
    items: list[JobListing]
