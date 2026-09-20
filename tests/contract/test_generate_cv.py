from fastapi.testclient import TestClient

from app.api.generate_cv import get_generation_service
from app.core.auth import require_user_id
from app.main import app
from app.services.azure_openai import AzureOpenAIError
from app.services.cv_generation import CvGenerationService


VALID_CV = {
    "personalInfo": {
        "fullName": "Ana García",
        "email": "ana@example.com",
        "phone": "",
        "location": "Madrid",
        "linkedin": "",
        "website": "",
    },
    "summary": "Product designer",
    "experience": [],
    "education": [],
    "skills": {"hard": [], "soft": []},
    "languages": [],
    "certifications": [],
}


class FakeRepository:
    def __init__(self) -> None:
        self.rows: dict[tuple[str, str], dict] = {}

    def get_by_request(self, user_id: str, request_id: str) -> dict | None:
        return self.rows.get((user_id, request_id))

    def create(self, user_id: str, request_id: str, data: dict) -> dict:
        row = {"user_id": user_id, "request_id": request_id, "data": data}
        self.rows[(user_id, request_id)] = row
        return row


class FakeProvider:
    def __init__(self, response: dict | None = None, error: Exception | None = None) -> None:
        self.response = response
        self.error = error
        self.calls = 0

    async def generate_cv(self, text: str) -> dict:
        self.calls += 1
        if self.error:
            raise self.error
        return self.response or VALID_CV


def make_client(service: CvGenerationService) -> TestClient:
    app.dependency_overrides[require_user_id] = lambda: "user-1"
    app.dependency_overrides[get_generation_service] = lambda: service
    return TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_generation_returns_validated_cv_and_sends_required_headers() -> None:
    provider = FakeProvider()
    client = make_client(CvGenerationService(provider=provider, repository=FakeRepository()))

    response = client.post(
        "/api/generate-cv",
        headers={"Authorization": "Bearer token", "Idempotency-Key": "00000000-0000-0000-0000-000000000001"},
        json={"text": "Ana es product designer"},
    )

    assert response.status_code == 200
    assert response.json() == VALID_CV
    assert provider.calls == 1


def test_generation_rejects_missing_idempotency_key() -> None:
    client = make_client(CvGenerationService(provider=FakeProvider(), repository=FakeRepository()))

    response = client.post("/api/generate-cv", json={"text": "Perfil"})

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "missing_idempotency_key"


def test_generation_rejects_client_user_id() -> None:
    client = make_client(CvGenerationService(provider=FakeProvider(), repository=FakeRepository()))

    response = client.post(
        "/api/generate-cv",
        headers={"Idempotency-Key": "00000000-0000-0000-0000-000000000001"},
        json={"text": "Perfil", "userId": "another-user"},
    )

    assert response.status_code == 422


def test_generation_maps_invalid_model_response_to_422_without_secret() -> None:
    client = make_client(
        CvGenerationService(
            provider=FakeProvider(response={"unexpected": "value"}),
            repository=FakeRepository(),
        )
    )

    response = client.post(
        "/api/generate-cv",
        headers={"Idempotency-Key": "00000000-0000-0000-0000-000000000001"},
        json={"text": "Perfil"},
    )

    assert response.status_code == 422
    assert "unexpected" not in response.text


def test_generation_maps_provider_failure_to_502() -> None:
    client = make_client(
        CvGenerationService(
            provider=FakeProvider(error=AzureOpenAIError("provider secret")),
            repository=FakeRepository(),
        )
    )

    response = client.post(
        "/api/generate-cv",
        headers={"Idempotency-Key": "00000000-0000-0000-0000-000000000001"},
        json={"text": "Perfil"},
    )

    assert response.status_code == 502
    assert "provider secret" not in response.text