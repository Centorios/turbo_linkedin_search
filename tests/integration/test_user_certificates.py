import asyncio
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.services.profile_certificate_service import (
    CertificateConflictError, CertificateLimitError, CertificateNotFoundError,
    InvalidCertificateExtractionError, ProfileCertificateService,
)


USER = "00000000-0000-0000-0000-000000000001"
OTHER = "00000000-0000-0000-0000-000000000002"
PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\x01IHDR" + b"image-data"


class FakeProvider:
    def __init__(self):
        self.calls = 0

    async def extract_certificate(self, **kwargs):
        self.calls += 1
        return {"certification": {"name": "Curso", "issuer": "Academia", "issueDate": "2025",
                "expirationDate": "", "credential": "ABC"}, "language": None, "needsReview": False}


class MemoryRepository:
    def __init__(self):
        self.rows = []

    def get(self, user_id, certificate_id):
        return next((row for row in self.rows if row["user_id"] == user_id and row["id"] == certificate_id), None)

    def get_by_request(self, user_id, request_id):
        return next((row for row in self.rows if row["user_id"] == user_id and row["request_id"] == request_id), None)

    def get_by_hash(self, user_id, digest):
        return next((row for row in self.rows if row["user_id"] == user_id and row["content_sha256"] == digest), None)

    def list(self, user_id, offset=0, limit=50):
        return [row for row in self.rows if row["user_id"] == user_id][offset:offset + limit + 1]

    def create(self, record, content):
        existing = self.get_by_hash(record["user_id"], record["content_sha256"])
        if existing:
            return existing, True
        row = {**record, "created_at": datetime.now(timezone.utc).isoformat()}
        self.rows.append(row)
        return row, False

    def delete(self, user_id, certificate_id):
        row = self.get(user_id, certificate_id)
        if row is None:
            return False
        self.rows.remove(row)
        return True


@pytest.mark.asyncio
async def test_upload_is_reusable_once_per_profile_and_ownership_is_enforced():
    provider, repository = FakeProvider(), MemoryRepository()
    service = ProfileCertificateService(provider=provider, repository=repository)
    first = await service.upload(USER, str(uuid4()), "curso.png", "image/png", PNG)
    duplicate = await service.upload(USER, str(uuid4()), "curso.png", "image/png", PNG)
    assert first.id == duplicate.id and duplicate.duplicate
    assert provider.calls == 1 and len(repository.rows) == 1
    assert len(service.selected(USER, [str(first.id)])) == 1
    with pytest.raises(InvalidCertificateExtractionError):
        service.selected(OTHER, [str(first.id)])


@pytest.mark.asyncio
async def test_reused_request_id_with_different_file_is_conflict():
    service = ProfileCertificateService(provider=FakeProvider(), repository=MemoryRepository())
    request_id = str(uuid4())
    await service.upload(USER, request_id, "curso.png", "image/png", PNG)
    with pytest.raises(CertificateConflictError):
        await service.upload(USER, request_id, "otro.png", "image/png", PNG + b"other")


@pytest.mark.asyncio
async def test_profile_limit_rejects_new_credential_but_keeps_existing_accessible():
    repository = MemoryRepository()
    service = ProfileCertificateService(provider=FakeProvider(), repository=repository)
    for number in range(50):
        repository.rows.append({
            "id": str(uuid4()), "user_id": USER, "request_id": str(uuid4()),
            "content_sha256": f"{number:064x}", "original_filename": f"old-{number}.pdf",
            "mime_type": "application/pdf", "file_size_bytes": 10, "status": "ready",
            "name": f"Old course {number}", "issuer": "Academia", "issue_date": "2024",
            "expiration_date": "", "credential": f"OLD-{number}",
            "language_name": "", "language_proficiency": "", "created_at": datetime.now(timezone.utc).isoformat(),
        })
    with pytest.raises(CertificateLimitError):
        await service.upload(USER, str(uuid4()), "new.png", "image/png", PNG)
    assert len(service.list(USER, 0, 50).items) == 50
    pending = repository.rows[0]
    pending["status"] = "pending_review"
    with pytest.raises(InvalidCertificateExtractionError):
        service.selected(USER, [pending["id"]])


@pytest.mark.asyncio
async def test_simultaneous_uploads_reuse_one_profile_record():
    provider, repository = FakeProvider(), MemoryRepository()
    service = ProfileCertificateService(provider=provider, repository=repository)
    first, second = await asyncio.gather(
        service.upload(USER, str(uuid4()), "one.png", "image/png", PNG),
        service.upload(USER, str(uuid4()), "two.png", "image/png", PNG),
    )
    assert first.id == second.id
    assert len(repository.rows) == 1


@pytest.mark.asyncio
async def test_delete_is_scoped_to_owner_and_allows_reupload():
    repository = MemoryRepository()
    service = ProfileCertificateService(provider=FakeProvider(), repository=repository)
    first = await service.upload(USER, str(uuid4()), "curso.png", "image/png", PNG)
    with pytest.raises(CertificateNotFoundError):
        service.delete(OTHER, str(first.id))
    assert len(repository.rows) == 1
    service.delete(USER, str(first.id))
    assert repository.rows == []
    with pytest.raises(InvalidCertificateExtractionError):
        service.selected(USER, [str(first.id)])
    second = await service.upload(USER, str(uuid4()), "curso.png", "image/png", PNG)
    assert second.id != first.id
