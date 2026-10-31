from fastapi.testclient import TestClient

from app.api.generate_cv import get_generation_service
from app.core.auth import require_user_id
from app.main import app
from app.services.azure_openai import AzureOpenAIError
from app.services.cv_generation import CvGenerationService
from app.services.profile_certificate_service import InvalidCertificateExtractionError


VALID_CV = {
    "personalInfo": {
        "fullName": "Ana García",
        "email": "ana@example.com",
        "phone": "",
        "location": "Madrid",
        "linkedin": "",
        "website": "",
        "photoPath": None,
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

    def create(self, user_id: str, request_id: str, data: dict,
               request_fingerprint: str | None = None,
               certificate_merge_report: dict | None = None) -> dict:
        row = {"user_id": user_id, "request_id": request_id, "data": data,
               "request_fingerprint": request_fingerprint,
               "certificate_merge_report": certificate_merge_report}
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
    assert response.json() == {**VALID_CV, "certificateMergeReport": {"addedIds": [], "duplicateIds": [], "pendingIds": []}}
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


def test_selected_certificate_is_merged_and_retried_as_same_snapshot() -> None:
    certificate_id = "00000000-0000-0000-0000-000000000099"

    class FakeCertificates:
        def selected(self, user_id, ids):
            assert ids == [certificate_id]
            return [{"id": certificate_id, "certification": {
                "name": "Curso", "issuer": "Academia", "issueDate": "2025",
                "expirationDate": "", "credential": "ABC",
            }, "language": None}]

    provider, repository = FakeProvider(), FakeRepository()
    client = make_client(CvGenerationService(provider=provider, repository=repository,
                                           certificate_service=FakeCertificates()))
    headers = {"Idempotency-Key": "00000000-0000-0000-0000-000000000088"}
    payload = {"text": "Perfil", "selectedCertificateIds": [certificate_id]}
    first = client.post("/api/generate-cv", headers=headers, json=payload)
    second = client.post("/api/generate-cv", headers=headers, json=payload)

    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert first.json()["certificateMergeReport"]["addedIds"] == [certificate_id]
    assert first.json()["certifications"][0]["credential"] == "ABC"
    assert provider.calls == 1
    assert client.post("/api/generate-cv", headers=headers, json={**payload, "text": "Otro"}).status_code == 409


def test_selected_foreign_or_pending_certificate_returns_422() -> None:
    class FakeCertificates:
        def selected(self, user_id, ids):
            raise InvalidCertificateExtractionError("Un certificado seleccionado no está disponible")

    client = make_client(CvGenerationService(provider=FakeProvider(), repository=FakeRepository(),
                                           certificate_service=FakeCertificates()))
    response = client.post("/api/generate-cv", headers={"Idempotency-Key": "00000000-0000-0000-0000-000000000087"},
                           json={"text": "Perfil", "selectedCertificateIds": ["00000000-0000-0000-0000-000000000099"]})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_certificate_selection"


def test_selection_rejects_more_than_50_ids() -> None:
    client = make_client(CvGenerationService(provider=FakeProvider(), repository=FakeRepository()))
    ids = [f"00000000-0000-0000-0000-{index:012d}" for index in range(1, 52)]
    response = client.post("/api/generate-cv", headers={"Idempotency-Key": "00000000-0000-0000-0000-000000000086"},
                           json={"text": "Perfil", "selectedCertificateIds": ids})
    assert response.status_code == 422


def test_existing_cv_credential_is_not_duplicated() -> None:
    certificate_id = "00000000-0000-0000-0000-000000000085"
    certification = {"name": "Curso", "issuer": "Academia", "issueDate": "2025",
                     "expirationDate": "", "credential": "ABC"}

    class FakeCertificates:
        def selected(self, user_id, ids):
            return [{"id": certificate_id, "certification": certification, "language": None}]

    provider = FakeProvider(response={**VALID_CV, "certifications": [certification]})
    client = make_client(CvGenerationService(provider=provider, repository=FakeRepository(),
                                           certificate_service=FakeCertificates()))
    response = client.post("/api/generate-cv", headers={"Idempotency-Key": "00000000-0000-0000-0000-000000000084"},
                           json={"text": "Curso de Academia", "selectedCertificateIds": [certificate_id]})
    assert response.status_code == 200
    assert response.json()["certifications"] == [certification]
    assert response.json()["certificateMergeReport"]["duplicateIds"] == [certificate_id]
