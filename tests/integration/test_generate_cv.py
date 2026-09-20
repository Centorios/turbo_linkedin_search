from fastapi.testclient import TestClient

from app.api.generate_cv import get_generation_service
from app.core.auth import require_user_id
from app.main import app
from app.services.cv_generation import CvGenerationService

from tests.contract.test_generate_cv import FakeProvider, FakeRepository, VALID_CV


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