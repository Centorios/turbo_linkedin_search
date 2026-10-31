"""Editing a history version: POST /api/resumes/{id}/edits and /versions.

Uses the real CvImportService; only the AI provider and the database are faked.
"""

from __future__ import annotations

import copy
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.api.cv_imports import get_cv_import_service
from app.core.auth import require_user_id
from app.main import app
from app.services.azure_openai import AzureOpenAIError
from app.services.cv_import import CvImportService


USER_ID = "00000000-0000-0000-0000-000000000001"
OTHER_USER_ID = "00000000-0000-0000-0000-000000000002"
GENERATED_ID = "00000000-0000-0000-0000-000000000101"
IMPORTED_ID = "00000000-0000-0000-0000-000000000102"
OTHER_ACCOUNT_ID = "00000000-0000-0000-0000-000000000103"
SOURCE_ID = "00000000-0000-0000-0000-000000000201"
HEADERS = {"Authorization": "Bearer test-token"}
CV = {
    "personalInfo": {
        "fullName": "Juan Pérez",
        "email": "juan@example.com",
        "phone": "",
        "location": "Argentina",
        "linkedin": "",
        "website": "",
        "photoPath": None,
    },
    "summary": "Desarrollador junior",
    "experience": [],
    "education": [],
    "skills": {"hard": ["C"], "soft": []},
    "languages": [],
    "certifications": [],
}


def edited_cv() -> dict[str, Any]:
    cv = copy.deepcopy(CV)
    cv["skills"]["hard"] = ["C", "Python"]
    return cv


def test_identical_version_returns_no_changes(setup) -> None:
    client, _, repository = setup
    response = client.post(f"/api/resumes/{GENERATED_ID}/versions", headers={**HEADERS, "Idempotency-Key": "00000000-0000-0000-0000-000000000801"}, json={"data": CV})
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "no_changes"
    assert repository.created == 0


def test_selected_certificate_creates_derived_version_without_changing_base(setup, monkeypatch) -> None:
    client, _, repository = setup
    certificate_id = "00000000-0000-0000-0000-000000000802"

    class FakeCertificates:
        def selected(self, user_id, ids):
            assert user_id == USER_ID and ids == [certificate_id]
            return [{"id": certificate_id, "certification": {
                "name": "Curso", "issuer": "Academia", "issueDate": "2025",
                "expirationDate": "", "credential": "A1",
            }, "language": None}]

    monkeypatch.setattr("app.services.cv_import.ProfileCertificateService", FakeCertificates)
    response = client.post(f"/api/resumes/{GENERATED_ID}/versions", headers={**HEADERS, "Idempotency-Key": "00000000-0000-0000-0000-000000000803"}, json={"data": CV, "selectedCertificateIds": [certificate_id]})
    assert response.status_code == 201
    assert response.json()["certificateMergeReport"]["addedIds"] == [certificate_id]
    assert response.json()["data"]["certifications"][0]["credential"] == "A1"
    assert repository.rows[GENERATED_ID]["data"]["certifications"] == []


def test_foreign_photo_path_is_rejected_without_creating_version(setup) -> None:
    client, _, repository = setup
    data = edited_cv()
    data["personalInfo"]["photoPath"] = f"{OTHER_USER_ID}/00000000-0000-0000-0000-000000000005.jpg"
    response = client.post(f"/api/resumes/{GENERATED_ID}/versions", headers={**HEADERS, "Idempotency-Key": "00000000-0000-0000-0000-000000000804"}, json={"data": data})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_photo"
    assert repository.created == 0


class FakeProvider:
    def __init__(self) -> None:
        self.result: dict[str, Any] = {"status": "ready", "proposedCv": edited_cv()}
        self.error: Exception | None = None
        self.calls: list[tuple[dict, str, list[str]]] = []

    async def edit_cv(self, base_cv: dict, instruction: str, answers: list[str]) -> dict:
        self.calls.append((base_cv, instruction, answers))
        if self.error is not None:
            raise self.error
        return self.result


class FakeRepository:
    """In-memory `resumes` table with the same idempotency rule as CvImportRepository."""

    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = {
            GENERATED_ID: self._row(GENERATED_ID, USER_ID, None),
            IMPORTED_ID: self._row(IMPORTED_ID, USER_ID, SOURCE_ID),
            OTHER_ACCOUNT_ID: self._row(OTHER_ACCOUNT_ID, OTHER_USER_ID, None),
        }
        self.created = 0

    @staticmethod
    def _row(resume_id: str, user_id: str, source_id: str | None, **extra: Any) -> dict[str, Any]:
        return {
            "id": resume_id,
            "user_id": user_id,
            "source_id": source_id,
            "parent_resume_id": None,
            "request_id": None,
            "data": copy.deepcopy(CV),
            "created_at": "2026-10-17T00:33:00Z",
            **extra,
        }

    def get_resume(self, user_id: str, resume_id: str) -> dict | None:
        row = self.rows.get(resume_id)
        return row if row and row["user_id"] == user_id else None

    def create_version(self, user_id, source_id, request_id, parent_resume_id, data,
                       request_fingerprint=None, certificate_merge_report=None) -> dict:
        for row in self.rows.values():
            if row["user_id"] == user_id and row["request_id"] == request_id:
                if row["source_id"] != source_id or row["parent_resume_id"] != parent_resume_id:
                    raise ValueError("Idempotency key was already used for a different version")
                return row
        self.created += 1
        new_id = f"00000000-0000-0000-0000-{900 + self.created:012d}"
        row = self._row(new_id, user_id, source_id, parent_resume_id=parent_resume_id, request_id=request_id,
                        data=data, request_fingerprint=request_fingerprint,
                        certificate_merge_report=certificate_merge_report)
        self.rows[new_id] = row
        return row


@pytest.fixture
def setup():
    provider, repository = FakeProvider(), FakeRepository()
    app.dependency_overrides[require_user_id] = lambda: USER_ID
    app.dependency_overrides[get_cv_import_service] = lambda: CvImportService(provider=provider, repository=repository)
    yield TestClient(app), provider, repository
    app.dependency_overrides.clear()


def test_proposes_changes_for_a_generated_cv(setup) -> None:
    client, provider, _ = setup

    response = client.post(f"/api/resumes/{GENERATED_ID}/edits", headers=HEADERS, json={"instruction": "Agregá Python"})

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["changedSections"] == ["skills"]
    assert body["proposedCv"]["skills"]["hard"] == ["C", "Python"]
    base_cv, instruction, answers = provider.calls[0]
    assert base_cv["personalInfo"]["fullName"] == "Juan Pérez"
    assert (instruction, answers) == ("Agregá Python", [])


def test_asks_for_missing_facts_and_iterates_on_the_current_proposal(setup) -> None:
    client, provider, _ = setup
    provider.result = {"status": "needs_input", "questions": ["¿En qué año empezaste?"]}

    asked = client.post(f"/api/resumes/{GENERATED_ID}/edits", headers=HEADERS, json={"instruction": "Agregá mi trabajo"})
    assert asked.json() == {"status": "needs_input", "questions": ["¿En qué año empezaste?"]}

    provider.result = {"status": "ready", "proposedCv": edited_cv()}
    current = edited_cv()
    current["summary"] = "Propuesta anterior"
    client.post(
        f"/api/resumes/{GENERATED_ID}/edits",
        headers=HEADERS,
        json={"instruction": "Agregá mi trabajo", "answers": ["2022"], "currentCv": current},
    )
    base_cv, _, answers = provider.calls[-1]
    assert base_cv["summary"] == "Propuesta anterior"
    assert answers == ["2022"]


@pytest.mark.parametrize("resume_id", [OTHER_ACCOUNT_ID, "00000000-0000-0000-0000-000000000999"])
def test_another_accounts_or_missing_version_is_not_found(setup, resume_id) -> None:
    client, provider, repository = setup

    edit = client.post(f"/api/resumes/{resume_id}/edits", headers=HEADERS, json={"instruction": "Cambiá algo"})
    save = client.post(f"/api/resumes/{resume_id}/versions", headers={**HEADERS, "Idempotency-Key": "00000000-0000-0000-0000-000000000301"}, json={"data": CV})

    for response in (edit, save):
        assert response.status_code == 404
        assert response.json()["detail"] == {"code": "resume_not_found", "message": "No encontramos esa versión del CV."}
    assert provider.calls == []
    assert repository.created == 0


def test_saving_creates_a_new_version_and_keeps_the_original(setup) -> None:
    client, _, repository = setup

    response = client.post(
        f"/api/resumes/{GENERATED_ID}/versions",
        headers={**HEADERS, "Idempotency-Key": "00000000-0000-0000-0000-000000000301"},
        json={"data": edited_cv()},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] != GENERATED_ID
    assert body["parentResumeId"] == GENERATED_ID
    assert body["sourceId"] is None
    assert body["data"]["skills"]["hard"] == ["C", "Python"]
    assert repository.rows[GENERATED_ID]["data"]["skills"]["hard"] == ["C"]


def test_a_version_of_an_imported_pdf_keeps_its_source(setup) -> None:
    client, _, _ = setup

    response = client.post(
        f"/api/resumes/{IMPORTED_ID}/versions",
        headers={**HEADERS, "Idempotency-Key": "00000000-0000-0000-0000-000000000302"},
        json={"data": edited_cv()},
    )

    assert response.status_code == 201
    assert response.json()["sourceId"] == SOURCE_ID
    assert response.json()["parentResumeId"] == IMPORTED_ID


def test_saving_twice_with_the_same_key_creates_a_single_version(setup) -> None:
    client, _, repository = setup
    headers = {**HEADERS, "Idempotency-Key": "00000000-0000-0000-0000-000000000303"}

    first = client.post(f"/api/resumes/{GENERATED_ID}/versions", headers=headers, json={"data": edited_cv()})
    second = client.post(f"/api/resumes/{GENERATED_ID}/versions", headers=headers, json={"data": edited_cv()})
    conflict = client.post(f"/api/resumes/{IMPORTED_ID}/versions", headers=headers, json={"data": edited_cv()})

    assert first.json()["id"] == second.json()["id"]
    assert repository.created == 1
    assert conflict.status_code == 409


@pytest.mark.parametrize(
    ("provider_result", "provider_error", "status_code", "code"),
    [
        ({"status": "ready", "proposedCv": {"summary": "incompleto"}}, None, 422, "invalid_model_response"),
        ({"status": "otro"}, None, 422, "invalid_model_response"),
        (None, AzureOpenAIError("caído"), 502, "provider_unavailable"),
    ],
)
def test_invalid_or_failed_ai_responses(setup, provider_result, provider_error, status_code, code) -> None:
    client, provider, _ = setup
    provider.result = provider_result
    provider.error = provider_error

    response = client.post(f"/api/resumes/{GENERATED_ID}/edits", headers=HEADERS, json={"instruction": "Cambiá algo"})

    assert response.status_code == status_code
    assert response.json()["detail"]["code"] == code


def test_rejects_an_empty_instruction(setup) -> None:
    client, provider, _ = setup

    response = client.post(f"/api/resumes/{GENERATED_ID}/edits", headers=HEADERS, json={"instruction": "   "})

    assert response.status_code == 422
    assert provider.calls == []
