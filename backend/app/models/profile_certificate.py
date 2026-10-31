from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, StringConstraints, model_validator

from app.models.cv import Certification, Language, StrictModel


class CertificateMergeReport(StrictModel):
    addedIds: list[str] = Field(default_factory=list)
    duplicateIds: list[str] = Field(default_factory=list)
    pendingIds: list[str] = Field(default_factory=list)


class CertificateReviewRequest(StrictModel):
    certification: Certification
    language: Language | None = None


class CertificateExtractionResult(CertificateReviewRequest):
    needsReview: bool = False


class ProfileCertificate(StrictModel):
    id: UUID
    originalFilename: str
    mimeType: Literal["application/pdf", "image/jpeg", "image/png"]
    fileSizeBytes: int = Field(ge=1, le=5 * 1024 * 1024)
    status: Literal["pending_review", "ready"]
    certification: Certification
    language: Language | None = None
    createdAt: datetime
    duplicate: bool = False

    @model_validator(mode="after")
    def require_ready_name(self):
        if self.status == "ready" and not self.certification.name.strip():
            raise ValueError("A ready certificate requires a name")
        return self


class CertificatePage(StrictModel):
    items: list[ProfileCertificate]
    offset: int
    limit: int
    hasMore: bool


SelectedCertificateIds = Annotated[list[UUID], Field(default_factory=list, max_length=50)]
