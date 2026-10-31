from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, StringConstraints, field_validator

from app.models.cv import StrictModel, StructuredCv
from app.models.profile_certificate import CertificateMergeReport


class CvSource(StrictModel):
    id: UUID
    originalFilename: str
    fileSizeBytes: int = Field(gt=0, le=10 * 1024 * 1024)
    pageCount: int = Field(ge=1, le=20)
    createdAt: datetime

    @field_validator("originalFilename")
    @classmethod
    def validate_original_filename(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned or len(cleaned) > 255 or any(ord(char) < 32 for char in cleaned):
            raise ValueError("originalFilename must be a non-empty safe filename")
        return cleaned


class ResumeVersion(StrictModel):
    id: UUID
    # None for versions that come from a generated CV instead of an imported PDF.
    sourceId: UUID | None
    parentResumeId: UUID | None
    createdAt: datetime
    data: StructuredCv
    certificateMergeReport: CertificateMergeReport = Field(default_factory=CertificateMergeReport)


class CvImportResponse(StrictModel):
    source: CvSource
    resume: ResumeVersion


class EditRequest(StrictModel):
    baseResumeId: UUID
    instruction: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]
    answers: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]] = Field(
        default_factory=list,
        max_length=3,
    )
    currentCv: StructuredCv | None = None


ChangedSection = Literal[
    "personalInfo",
    "summary",
    "experience",
    "education",
    "skills",
    "languages",
    "certifications",
]


class EditNeedsInput(StrictModel):
    status: Literal["needs_input"]
    questions: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]] = Field(
        min_length=1,
        max_length=3,
    )


class EditReady(StrictModel):
    status: Literal["ready"]
    proposedCv: StructuredCv
    changedSections: list[ChangedSection]
    changeSummary: str


EditResponse = Annotated[EditNeedsInput | EditReady, Field(discriminator="status")]


class SaveVersionRequest(StrictModel):
    baseResumeId: UUID
    data: StructuredCv
    selectedCertificateIds: list[UUID] = Field(default_factory=list, max_length=50)


class ResumeEditRequest(StrictModel):
    """Edit request for a history version: the base resume comes from the URL."""

    instruction: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]
    answers: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]] = Field(
        default_factory=list,
        max_length=3,
    )
    currentCv: StructuredCv | None = None


class ResumeVersionRequest(StrictModel):
    data: StructuredCv
    selectedCertificateIds: list[UUID] = Field(default_factory=list, max_length=50)


class DeleteSourceResponse(StrictModel):
    deleted: Literal[True]
