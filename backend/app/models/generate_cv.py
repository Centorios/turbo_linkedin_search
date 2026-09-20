from uuid import UUID

from app.models.cv import StrictModel, StructuredCv


class GenerateCvRequest(StrictModel):
    text: str


def parse_request_id(value: str) -> UUID:
    try:
        return UUID(value)
    except ValueError as exc:
        raise ValueError("Idempotency-Key must be a UUID") from exc


class GenerateCvResponse(StructuredCv):
    pass