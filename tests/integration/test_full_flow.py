from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.api.generate_cv import get_generation_service
from app.core.auth import require_user_id
from app.core.supabase import get_auth_client
from app.main import app
from app.services.cv_generation import CvGenerationService
from tests.contract.test_generate_cv import FakeProvider, FakeRepository, VALID_CV


AUTHENTICATED_USER_ID = "00000000-0000-0000-0000-000000000001"


class FakeAuth:
    def get_user(self, token: str) -> SimpleNamespace:
        if token != "quickstart-access-token":
            raise RuntimeError("token rejected")
        return SimpleNamespace(user=SimpleNamespace(id=AUTHENTICATED_USER_ID))


class FakeAuthClient:
    auth = FakeAuth()


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_quickstart_authenticated_generation_persists_for_authenticated_user() -> None:
    repository = FakeRepository()
    provider = FakeProvider()
    service = CvGenerationService(provider=provider, repository=repository)
    app.dependency_overrides[get_auth_client] = lambda: FakeAuthClient()
    app.dependency_overrides[get_generation_service] = lambda: service
    client = TestClient(app)

    response = client.post(
        "/api/generate-cv",
        headers={
            "Authorization": "Bearer quickstart-access-token",
            "Idempotency-Key": "00000000-0000-0000-0000-000000000010",
        },
        json={"text": "Ana García, product designer. Experiencia y formación profesional."},
    )

    stored_row = repository.get_by_request(
        AUTHENTICATED_USER_ID,
        "00000000-0000-0000-0000-000000000010",
    )
    assert response.status_code == 200
    assert response.json() == VALID_CV
    assert stored_row is not None
    assert stored_row["user_id"] == AUTHENTICATED_USER_ID
    assert stored_row["data"] == VALID_CV
    assert provider.calls == 1