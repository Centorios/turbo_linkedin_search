from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.profile_certificates import get_certificate_service
from app.core.auth import require_user_id
from app.main import app
from app.services.profile_certificate_service import (
    CertificateNotFoundError, CertificateConflictError, CertificateLimitError,
    InvalidCertificateExtractionError,
)


USER_ID = "00000000-0000-0000-0000-000000000001"
CERTIFICATE_ID = "00000000-0000-0000-0000-000000000002"
CERTIFICATE = {
    "id": CERTIFICATE_ID, "originalFilename": "curso.pdf", "mimeType": "application/pdf",
    "fileSizeBytes": 10, "status": "ready", "certification": {
        "name": "Curso", "issuer": "Instituto", "issueDate": "2025", "expirationDate": "", "credential": "A1"
    }, "language": None, "createdAt": "2026-10-31T00:00:00Z", "duplicate": False,
}


class FakeService:
    def __init__(self):
        self.uploads = []
        self.upload_error = None
        self.deleted = []

    def list(self, user_id, offset, limit):
        assert user_id == USER_ID
        return {"items": [CERTIFICATE], "offset": offset, "limit": limit, "hasMore": False}

    async def upload(self, user_id, request_id, filename, mime_type, content):
        if self.upload_error:
            raise self.upload_error
        self.uploads.append((user_id, request_id, filename, mime_type, content))
        return CERTIFICATE

    def review(self, user_id, certificate_id, payload):
        if certificate_id != CERTIFICATE_ID:
            raise CertificateNotFoundError()
        return {**CERTIFICATE, "certification": payload.certification.model_dump()}

    def download(self, user_id, certificate_id):
        if certificate_id != CERTIFICATE_ID:
            raise CertificateNotFoundError()
        return b"%PDF-test", {"mime_type": "application/pdf", "original_filename": "curso.pdf"}

    def delete(self, user_id, certificate_id):
        if certificate_id != CERTIFICATE_ID:
            raise CertificateNotFoundError()
        self.deleted.append((user_id, certificate_id))


@pytest.fixture
def client():
    service = FakeService()
    app.dependency_overrides[require_user_id] = lambda: USER_ID
    app.dependency_overrides[get_certificate_service] = lambda: service
    yield TestClient(app), service
    app.dependency_overrides.clear()


def test_certificate_library_contract(client):
    http, service = client
    listed = http.get("/api/profile/certificates?offset=0&limit=50")
    assert listed.status_code == 200
    assert listed.json()["items"][0]["id"] == CERTIFICATE_ID

    headers = {"Idempotency-Key": str(uuid4()), "X-Original-Filename": "curso.pdf", "Content-Type": "application/pdf"}
    uploaded = http.post("/api/profile/certificates", headers=headers, content=b"%PDF-test")
    assert uploaded.status_code == 201
    assert service.uploads[0][-1] == b"%PDF-test"

    reviewed = http.patch(f"/api/profile/certificates/{CERTIFICATE_ID}", json={
        "certification": CERTIFICATE["certification"], "language": None,
    })
    assert reviewed.status_code == 200
    assert http.get(f"/api/profile/certificates/{CERTIFICATE_ID}/file").content == b"%PDF-test"
    deleted = http.delete(f"/api/profile/certificates/{CERTIFICATE_ID}")
    assert deleted.status_code == 204
    assert service.deleted == [(USER_ID, CERTIFICATE_ID)]


def test_certificate_library_failure_returns_a_readable_error(client):
    http, service = client
    def unavailable(user_id, offset, limit):
        raise RuntimeError("database unavailable")
    service.list = unavailable
    response = http.get("/api/profile/certificates", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 500
    assert response.json()["detail"]["code"] == "certificate_list_failed"
    assert "database unavailable" not in response.text
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_invalid_uploads_are_rejected_before_service(client):
    http, service = client
    path = "/api/profile/certificates"
    assert http.post(path, content=b"file").status_code == 400
    assert http.post(path, headers={"Idempotency-Key": str(uuid4()), "X-Original-Filename": "a.txt", "Content-Type": "text/plain"}, content=b"file").status_code == 415
    assert http.post(path, headers={"Idempotency-Key": str(uuid4()), "X-Original-Filename": "a.pdf", "Content-Type": "application/pdf"}, content=b"x" * (5 * 1024 * 1024 + 1)).status_code == 413
    assert not service.uploads


def test_missing_and_foreign_certificates_are_indistinguishable(client):
    http, _ = client
    missing = str(uuid4())
    assert http.get(f"/api/profile/certificates/{missing}/file").json()["detail"]["code"] == "certificate_not_found"
    assert http.patch(f"/api/profile/certificates/{missing}", json={"certification": CERTIFICATE["certification"]}).status_code == 404
    assert http.delete(f"/api/profile/certificates/{missing}").json()["detail"]["code"] == "certificate_not_found"


def test_certificate_library_requires_authentication():
    app.dependency_overrides[get_certificate_service] = lambda: FakeService()
    response = TestClient(app).get("/api/profile/certificates")
    delete_response = TestClient(app).delete(f"/api/profile/certificates/{CERTIFICATE_ID}")
    app.dependency_overrides.clear()
    assert response.status_code == 401
    assert delete_response.status_code == 401


@pytest.mark.parametrize("cause,status_code,code", [
    (InvalidCertificateExtractionError("No se pudo leer"), 422, "invalid_extraction"),
    (CertificateLimitError(), 409, "certificate_limit"),
    (CertificateConflictError(), 409, "idempotency_conflict"),
])
def test_upload_errors_are_mapped_to_safe_contract(client, cause, status_code, code):
    http, service = client
    service.upload_error = cause
    response = http.post("/api/profile/certificates", headers={
        "Idempotency-Key": str(uuid4()), "X-Original-Filename": "curso.pdf", "Content-Type": "application/pdf",
    }, content=b"%PDF-test")
    assert response.status_code == status_code
    assert response.json()["detail"]["code"] == code


def test_same_upload_key_returns_same_certificate(client):
    http, service = client
    headers = {"Idempotency-Key": str(uuid4()), "X-Original-Filename": "curso.pdf", "Content-Type": "application/pdf"}
    first = http.post("/api/profile/certificates", headers=headers, content=b"%PDF-test")
    second = http.post("/api/profile/certificates", headers=headers, content=b"%PDF-test")
    assert first.json()["id"] == second.json()["id"]
    assert service.uploads[0][1] == service.uploads[1][1]
