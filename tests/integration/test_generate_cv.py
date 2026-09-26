from fastapi.testclient import TestClient
import pytest

from app.api.generate_cv import get_generation_service
from app.core.auth import require_user_id
from app.main import app
from app.services.cv_generation import CvGenerationService

from tests.contract.test_generate_cv import FakeProvider, FakeRepository, VALID_CV


USER_PROFILE = {
    "fullName": "Nombre confirmado",
    "email": "cv@example.com",
    "phone": "+34 600 000 000",
    "location": "Barcelona",
    "linkedin": "https://www.linkedin.com/in/confirmed",
    "website": "",
}


class FakeProfileRepository:
    def __init__(self, profile: dict[str, str] | None = None, fail: bool = False) -> None:
        self.profile = profile
        self.fail = fail
        self.calls = 0

    def get_by_user(self, user_id: str) -> dict[str, str] | None:
        self.calls += 1
        if self.fail:
            raise RuntimeError("private profile storage detail")
        return self.profile


@pytest.fixture
def generation_with_profile():
    provider = FakeProvider()
    resume_repository = FakeRepository()
    profile_repository = FakeProfileRepository(USER_PROFILE)
    service = CvGenerationService(
        provider=provider,
        repository=resume_repository,
        profile_repository=profile_repository,
    )
    app.dependency_overrides[require_user_id] = lambda: "user-1"
    app.dependency_overrides[get_generation_service] = lambda: service
    yield TestClient(app), provider, resume_repository, profile_repository
    app.dependency_overrides.clear()


def test_repeated_request_returns_original_result_without_second_provider_call() -> None:
    provider = FakeProvider()
    repository = FakeRepository()
    service = CvGenerationService(provider=provider, repository=repository)
    app.dependency_overrides[require_user_id] = lambda: "user-1"
    app.dependency_overrides[get_generation_service] = lambda: service
    client = TestClient(app)
    headers = {"Idempotency-Key": "00000000-0000-0000-0000-000000000002"}

    first = client.post("/api/generate-cv", headers=headers, json={"text": "Perfil original"})
    second = client.post("/api/generate-cv", headers=headers, json={"text": "Texto distinto"})

    app.dependency_overrides.clear()
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == VALID_CV
    assert provider.calls == 1


def test_missing_authentication_is_rejected_before_generation() -> None:
    app.dependency_overrides[get_generation_service] = lambda: CvGenerationService(
        provider=FakeProvider(), repository=FakeRepository()
    )
    client = TestClient(app)

    response = client.post(
        "/api/generate-cv",
        headers={"Idempotency-Key": "00000000-0000-0000-0000-000000000003"},
        json={"text": "Perfil"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 401


def test_profile_overrides_nonempty_personal_fields_and_preserves_professional_sections(
    generation_with_profile,
) -> None:
    client, provider, resume_repository, _ = generation_with_profile
    request_id = "00000000-0000-0000-0000-000000000020"

    response = client.post(
        "/api/generate-cv",
        headers={"Idempotency-Key": request_id},
        json={"text": "Perfil con datos de contacto desactualizados"},
    )

    expected_personal = {
        "fullName": "Nombre confirmado",
        "email": "cv@example.com",
        "phone": "+34 600 000 000",
        "location": "Barcelona",
        "linkedin": "https://www.linkedin.com/in/confirmed",
        "website": "",
    }
    assert response.status_code == 200
    assert response.json()["personalInfo"] == expected_personal
    assert response.json()["summary"] == VALID_CV["summary"]
    assert response.json()["experience"] == VALID_CV["experience"]
    assert response.json()["education"] == VALID_CV["education"]
    assert response.json()["skills"] == VALID_CV["skills"]
    assert response.json()["languages"] == VALID_CV["languages"]
    assert response.json()["certifications"] == VALID_CV["certifications"]
    assert resume_repository.rows[("user-1", request_id)]["data"]["personalInfo"] == expected_personal
    assert provider.calls == 1


def test_empty_profile_fields_fall_back_to_generated_personal_information(
    generation_with_profile,
) -> None:
    client, _, _, profile_repository = generation_with_profile
    profile_repository.profile = {**USER_PROFILE, "phone": "", "email": "", "website": ""}

    response = client.post(
        "/api/generate-cv",
        headers={"Idempotency-Key": "00000000-0000-0000-0000-000000000021"},
        json={"text": "Perfil"},
    )

    assert response.status_code == 200
    assert response.json()["personalInfo"]["email"] == VALID_CV["personalInfo"]["email"]
    assert response.json()["personalInfo"]["phone"] == VALID_CV["personalInfo"]["phone"]
    assert response.json()["personalInfo"]["website"] == VALID_CV["personalInfo"]["website"]
    assert response.json()["personalInfo"]["fullName"] == "Nombre confirmado"


def test_profile_read_failure_stops_provider_and_persistence(generation_with_profile) -> None:
    client, provider, resume_repository, profile_repository = generation_with_profile
    profile_repository.fail = True

    response = client.post(
        "/api/generate-cv",
        headers={"Idempotency-Key": "00000000-0000-0000-0000-000000000022"},
        json={"text": "Perfil"},
    )

    assert response.status_code == 500
    assert "private profile storage detail" not in response.text
    assert provider.calls == 0
    assert resume_repository.rows == {}


def test_idempotent_result_uses_current_profile_without_second_provider_call(generation_with_profile) -> None:
    client, provider, resume_repository, profile_repository = generation_with_profile
    request_id = "00000000-0000-0000-0000-000000000023"
    headers = {"Idempotency-Key": request_id}

    first = client.post("/api/generate-cv", headers=headers, json={"text": "Perfil original"})
    profile_repository.profile = {**USER_PROFILE, "fullName": "Nombre actualizado", "email": ""}
    second = client.post("/api/generate-cv", headers=headers, json={"text": "Texto distinto"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["personalInfo"]["fullName"] == "Nombre actualizado"
    assert second.json()["personalInfo"]["email"] == USER_PROFILE["email"]
    assert provider.calls == 1
    assert len(resume_repository.rows) == 1