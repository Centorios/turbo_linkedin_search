from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.models.cv import StrictModel, StructuredCv


class ResumeSummary(StrictModel):
    id: UUID
    createdAt: datetime
    fullName: str
    summary: str


class ResumeHistoryPage(StrictModel):
    items: list[ResumeSummary]
    offset: int = Field(ge=0, le=100000)
    limit: int = Field(ge=1, le=50)
    hasMore: bool


class ResumeDetail(StrictModel):
    id: UUID
    createdAt: datetime
    data: StructuredCv
