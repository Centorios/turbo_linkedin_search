from __future__ import annotations

from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.api.cv_imports import get_cv_import_service
from app.core.auth import require_user_id
from app.core.supabase import get_auth_client
from app.main import app
from app.services.cv_import import InvalidCvImportResponseError, InvalidPdfError
from tests.cv_pdf_fixtures import pdf_with_text


USER_ID = "00000000-0000-0000-0000-000000000001"
REQUEST_ID = "00000000-0000-0000-0000-000000000010"
SOURCE_ID = "00000000-0000-0000-0000-000000000011"
RESUME_ID = "00000000-0000-0000-0000-000000000012"
CV = {
    "personalInfo": {
        "fullName": "Ana García",
        "email": "ana@example.com",
        "phone": "",
        "location": "Buenos Aires",
        "linkedin": "",
        "website": "",
        "photoPath": None,
    },
    "summary": "Desarrolladora de software",
    "experience": [],
    "education": [],
    "skills": {"hard": ["Python"], "soft": []},
    "languages": [],
    "certifications": [],
}


class FakeImportService:
    def __init__(self) -> None:
        self.import_args: tuple | None = None
        self.import_error: Exception | None = None
        self.edit_result = {
            "status": "needs_input",
            "questions": ["¿En qué fecha comenzó esta experiencia?"],
        }
        self.edit_error: Exception | None = None
        self.deleted: list[str] = []
        self.save_request_ids: list[str] = []
        self.saved_certificate_ids: list[str] = []

    async def import_pdf(self, user_id: str, request_id: str, filename: str, pdf: bytes) -> dict:
        if self.import_error is not None:
            raise self.import_error
        self.import_args = (user_id, request_id, filename, pdf)
        return {
            "source": {
                "id": SOURCE_ID,
                "originalFilename": filename,
                "fileSizeBytes": len(pdf),
                "pageCount": 1,
                "createdAt": "2026-10-14T12:00:00Z",
            },
            "resume": {
                "id": RESUME_ID,
                "sourceId": SOURCE_ID,
                "parentResumeId": None,
                "createdAt": "2026-10-14T12:00:00Z",
                "data": CV,
            },
        }

    async def propose_edit(self, user_id: str, source_id: str, request) -> dict:
        if self.edit_error is not None:
            raise self.edit_error
        return self.edit_result

    def save_version(self, user_id: str, source_id: str, request_id: str, request) -> dict:
        self.save_request_ids.append(request_id)
        self.saved_certificate_ids = [str(value) for value in request.selectedCertificateIds]
        return {
            "id": RESUME_ID,
            "sourceId": source_id,
            "parentResumeId": request.baseResumeId,
            "createdAt": "2026-10-14T12:00:00Z",
            "data": request.data.model_dump(),
            "certificateMergeReport": {"addedIds": self.saved_certificate_ids, "duplicateIds": [], "pendingIds": []},
        }

    def download_source(self, user_id: str, source_id: str) -> tuple[bytes, str]:
        return b"%PDF-source", "original.pdf"

    def delete_source(self, user_id: str, source_id: str) -> None:
        self.deleted.append(source_id)


@pytest.fixture
def import_service():
    service = FakeImportService()
    app.dependency_overrides[require_user_id] = lambda: USER_ID
    app.dependency_overrides[get_cv_import_service] = lambda: service
    yield service
    app.dependency_overrides.clear()


def pdf_headers(filename: str = "CV%20Ana.pdf", request_id: str = REQUEST_ID) -> dict[str, str]:
    return {
        "Authorization": "Bearer test-token",
        "Content-Type": "application/pdf",
        "X-Original-Filename": filename,
        "Idempotency-Key": request_id,
    }


def test_import_requires_pdf_and_passes_safe_filename_and_user(import_service) -> None:
    pdf = pdf_with_text("Ana García")

    response = TestClient(app).post("/api/cv-imports", headers=pdf_headers(), content=pdf)

    assert response.status_code == 201
    assert response.json()["source"]["originalFilename"] == "CV Ana.pdf"
    assert import_service.import_args == (USER_ID, UUID(REQUEST_ID).__str__(), "CV Ana.pdf", pdf)


def test_import_rejects_wrong_content_type_and_oversized_body(import_service) -> None:
    client = TestClient(app)
    wrong_type = client.post(
        "/api/cv-imports",
        headers={**pdf_headers(), "Content-Type": "application/octet-stream"},
        content=b"%PDF-invalid",
    )
    oversized = client.post(
        "/api/cv-imports",
        headers=pdf_headers(),
        content=b"x" * (10 * 1024 * 1024 + 1),
    )

    assert wrong_type.status_code == 415
    assert oversized.status_code == 413
    assert import_service.import_args is None


def test_import_rejects_invalid_idempotency_key(import_service) -> None:
    response = TestClient(app).post(
        "/api/cv-imports",
        headers=pdf_headers(request_id="not-a-uuid"),
        content=pdf_with_text("Ana"),
    )

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "invalid_idempotency_key"
    assert import_service.import_args is None


def test_import_translates_invalid_pdf_to_actionable_contract_error(import_service) -> None:
    import_service.import_error = InvalidPdfError("El PDF no contiene texto extraíble")
    response = TestClient(app).post(
        "/api/cv-imports",
        headers=pdf_headers(),
        content=pdf_with_text("Ana"),
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_pdf"
    assert "texto extraíble" in response.json()["detail"]["message"]


def test_import_requires_authentication() -> None:
    app.dependency_overrides[get_auth_client] = lambda: None
    app.dependency_overrides[get_cv_import_service] = lambda: FakeImportService()
    response = TestClient(app).post(
        "/api/cv-imports",
        headers={
            "Content-Type": "application/pdf",
            "X-Original-Filename": "CV.pdf",
            "Idempotency-Key": REQUEST_ID,
        },
        content=pdf_with_text("Ana"),
    )
    app.dependency_overrides.clear()

    assert response.status_code == 401


def test_edit_returns_clarification_and_save_returns_a_new_version(import_service) -> None:
    client = TestClient(app)
    edit = client.post(
        f"/api/cv-imports/{SOURCE_ID}/edits",
        headers={"Authorization": "Bearer test-token"},
        json={"baseResumeId": RESUME_ID, "instruction": "Agrega una experiencia", "currentCv": CV},
    )
    save = client.post(
        f"/api/cv-imports/{SOURCE_ID}/versions",
        headers={"Authorization": "Bearer test-token", "Idempotency-Key": REQUEST_ID},
        json={"baseResumeId": RESUME_ID, "data": CV},
    )

    assert edit.status_code == 200
    assert edit.json()["status"] == "needs_input"
    assert save.status_code == 201
    assert save.json()["parentResumeId"] == RESUME_ID

    repeated_save = client.post(
        f"/api/cv-imports/{SOURCE_ID}/versions",
        headers={"Authorization": "test-token", "Idempotency-Key": REQUEST_ID},
        json={"baseResumeId": RESUME_ID, "data": CV},
    )
    invalid_save = client.post(
        f"/api/cv-imports/{SOURCE_ID}/versions",
        headers={"Authorization": "test-token", "Idempotency-Key": REQUEST_ID},
        json={"baseResumeId": RESUME_ID, "data": {"summary": "CV incompleto"}},
    )

    assert repeated_save.status_code == 201
    assert repeated_save.json() == save.json()
    assert invalid_save.status_code == 422
    assert import_service.save_request_ids == [REQUEST_ID, REQUEST_ID]


def test_edit_accepts_ready_proposal_and_rejects_invalid_model_response(import_service) -> None:
    client = TestClient(app)
    import_service.edit_result = {
        "status": "ready",
        "proposedCv": CV,
        "changedSections": ["summary"],
        "changeSummary": "Se actualizó el resumen.",
    }
    ready = client.post(
        f"/api/cv-imports/{SOURCE_ID}/edits",
        headers={"Authorization": "test-token"},
        json={"baseResumeId": RESUME_ID, "instruction": "Mejora el resumen"},
    )
    import_service.edit_error = InvalidCvImportResponseError("invalid provider output")
    invalid_model_output = client.post(
        f"/api/cv-imports/{SOURCE_ID}/edits",
        headers={"Authorization": "test-token"},
        json={"baseResumeId": RESUME_ID, "instruction": "Mejora el resumen"},
    )

    assert ready.status_code == 200
    assert ready.json()["status"] == "ready"
    assert ready.json()["changedSections"] == ["summary"]
    assert invalid_model_output.status_code == 422
    assert invalid_model_output.json()["detail"]["code"] == "invalid_model_response"


def test_edit_enforces_instruction_answer_and_cv_request_limits(import_service) -> None:
    response = TestClient(app).post(
        f"/api/cv-imports/{SOURCE_ID}/edits",
        headers={"Authorization": "test-token"},
        json={
            "baseResumeId": RESUME_ID,
            "instruction": "x" * 4001,
            "answers": ["a", "b", "c", "d"],
            "currentCv": {"summary": "incompleto"},
        },
    )

    assert response.status_code == 422


def test_source_file_download_and_delete_are_available(import_service) -> None:
    client = TestClient(app)
    downloaded = client.get(
        f"/api/cv-imports/{SOURCE_ID}/file",
        headers={"Authorization": "Bearer test-token"},
    )
    deleted = client.delete(
        f"/api/cv-imports/{SOURCE_ID}",
        headers={"Authorization": "Bearer test-token"},
    )

    assert downloaded.status_code == 200
    assert downloaded.headers["content-type"] == "application/pdf"
    assert downloaded.content == b"%PDF-source"
    assert deleted.status_code == 204
    assert import_service.deleted == [SOURCE_ID]


def test_imported_version_forwards_selected_profile_certificates(import_service) -> None:
    certificate_id = "00000000-0000-0000-0000-000000000701"
    response = TestClient(app).post(
        f"/api/cv-imports/{SOURCE_ID}/versions",
        headers={"Idempotency-Key": str(UUID(int=702))},
        json={"baseResumeId": RESUME_ID, "data": CV, "selectedCertificateIds": [certificate_id]},
    )
    assert response.status_code == 201
    assert import_service.saved_certificate_ids == [certificate_id]
    assert response.json()["certificateMergeReport"]["addedIds"] == [certificate_id]
