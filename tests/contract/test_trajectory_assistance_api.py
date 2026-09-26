from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.api.trajectory_assistance import get_assistance_service
from app.core.supabase import get_auth_client
from app.main import app
from app.services.azure_openai import AzureOpenAIError


USER_ID = "00000000-0000-0000-0000-000000000001"
VALID_REQUEST = {"sourceText": "Coordiné una migración de facturación.", "answers": []}


class FakeAuth:
    def get_user(self, token: str) -> SimpleNamespace:
        if token != "valid-assistance-token":
            raise RuntimeError("token rejected")
        return SimpleNamespace(user=SimpleNamespace(id=USER_ID))


class FakeAuthClient:
    auth = FakeAuth()


class FakeAssistanceService:
    def __init__(self, result: dict | None = None, error: Exception | None = None) -> None:
        self.result = result
        self.error = error
        self.user_ids: list[str] = []

    async def assist(self, user_id: str, request) -> dict:
        self.user_ids.append(user_id)
        if self.error:
            raise self.error
        return self.result or {
            "state": "needs_input",
            "questions": [{"id": "q1", "text": "¿Qué resultado observaste?"}],
        }


@pytest.fixture
def assistance_service():
    service = FakeAssistanceService()
    app.dependency_overrides[get_auth_client] = lambda: FakeAuthClient()
    app.dependency_overrides[get_assistance_service] = lambda: service
    yield service
    app.dependency_overrides.clear()


def test_turn_requires_valid_bearer_and_passes_authenticated_user(assistance_service) -> None:
    client = TestClient(app)

    missing = client.post("/api/trajectory-assistance/turn", json=VALID_REQUEST)
    invalid = client.post(
        "/api/trajectory-assistance/turn",
        headers={"Authorization": "Bearer invalid"},
        json=VALID_REQUEST,
    )
    valid = client.post(
        "/api/trajectory-assistance/turn",
        headers={"Authorization": "Bearer valid-assistance-token"},
        json=VALID_REQUEST,
    )

    assert missing.status_code == 401
    assert invalid.status_code == 401
    assert valid.status_code == 200
    assert valid.json()["state"] == "needs_input"
    assert assistance_service.user_ids == [USER_ID]


def test_invalid_turn_body_returns_safe_422_without_echoing_text(assistance_service) -> None:
    private_text = "PRIVATE_TRAJECTORY_TEXT"
    response = TestClient(app).post(
        "/api/trajectory-assistance/turn",
        headers={"Authorization": "Bearer valid-assistance-token"},
        json={"sourceText": " ", "answers": [], "private": private_text},
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_assistance_request"
    assert private_text not in response.text
    assert assistance_service.user_ids == []


def test_provider_failure_returns_safe_502(assistance_service) -> None:
    assistance_service.error = AzureOpenAIError("private Azure response")

    response = TestClient(app).post(
        "/api/trajectory-assistance/turn",
        headers={"Authorization": "Bearer valid-assistance-token"},
        json=VALID_REQUEST,
    )

    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "provider_unavailable"
    assert "private Azure response" not in response.text