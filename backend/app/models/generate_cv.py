from uuid import UUID
from pydantic import Field

from app.models.cv import StrictModel, StructuredCv
from app.models.profile_certificate import CertificateMergeReport


class GenerateCvRequest(StrictModel):
    text: str
    selectedCertificateIds: list[UUID] = Field(default_factory=list, max_length=50)


def parse_request_id(value: str) -> UUID:
    try:
        return UUID(value)
    except ValueError as exc:
        raise ValueError("Idempotency-Key must be a UUID") from exc


class GenerateCvResponse(StructuredCv):
    certificateMergeReport: CertificateMergeReport = Field(default_factory=CertificateMergeReport)
