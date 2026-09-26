from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.api.profile import get_profile_repository
from app.core.auth import require_user_id
from app.core.supabase import get_auth_client
from app.main import app


USER_ID = "00000000-0000-0000-0000-000000000001"
PROFILE_BODY = {
    "fullName": "Ana García",
    "email": "ana.cv@example.com",
    "phone": "+34 600 000 000",
    "location": "Madrid",
    "linkedin": "https://www.linkedin.com/in/ana-garcia",
    "website": "https://ana.example.com",
}
VALID_HEADERS = {"Authorization": "Bearer valid-profile-token"}


class FakeAuth:
    def get_user(self, token: str) -> SimpleNamespace:
        if token != "valid-profile-token":
            raise RuntimeError("token rejected")
        return SimpleNamespace(user=SimpleNamespace(id=USER_ID))


class FakeAuthClient:
    auth = FakeAuth()


class FakeProfileRepository:
    def __init__(self) -> None:
        self.rows: dict[str, dict[str, str]] = {}
        self.fail_reads = False
        self.fail_writes = False

    def get_by_user(self, user_id: str) -> dict[str, str] | None:
        if self.fail_reads:
            raise RuntimeError("private database connection detail")
        return self.rows.get(user_id)

    def upsert(self, user_id: str, profile: dict[str, str]) -> dict[str, str]:
        if self.fail_writes:
            raise RuntimeError("private database connection detail")
        self.rows[user_id] = profile
        return profile


@pytest.fixture
def profile_repository() -> FakeProfileRepository:
    repository = FakeProfileRepository()
    app.dependency_overrides[get_auth_client] = lambda: FakeAuthClient()
    app.dependency_overrides[get_profile_repository] = lambda: repository
    yield repository
    app.dependency_overrides.clear()


def test_get_profile_returns_null_when_no_profile_exists(profile_repository: FakeProfileRepository) -> None:
    response = TestClient(app).get("/api/profile", headers=VALID_HEADERS)

    assert response.status_code == 200
    assert response.json() is None
    assert profile_repository.rows == {}


def test_put_profile_saves_for_authenticated_user_and_get_returns_it(
    profile_repository: FakeProfileRepository,
) -> None:
    client = TestClient(app)

    saved = client.put("/api/profile", headers=VALID_HEADERS, json=PROFILE_BODY)
    loaded = client.get("/api/profile", headers=VALID_HEADERS)

    assert saved.status_code == 200
    assert saved.json() == PROFILE_BODY
    assert loaded.status_code == 200
    assert loaded.json() == PROFILE_BODY
    assert profile_repository.rows == {USER_ID: PROFILE_BODY}


def test_profile_endpoints_reject_missing_invalid_and_expired_bearer(
    profile_repository: FakeProfileRepository,
) -> None:
    client = TestClient(app)

    missing = client.get("/api/profile")
    invalid = client.get("/api/profile", headers={"Authorization": "Bearer invalid"})
    expired = client.put(
        "/api/profile",
        headers={"Authorization": "Bearer expired"},
        json=PROFILE_BODY,
    )

    assert missing.status_code == 401
    assert invalid.status_code == 401
    assert expired.status_code == 401
    assert profile_repository.rows == {}


@pytest.mark.parametrize(
    "invalid_profile",
    [
        {**PROFILE_BODY, "fullName": "  "},
        {**PROFILE_BODY, "email": "invalid-email"},
        {**PROFILE_BODY, "linkedin": "ftp://example.com"},
        {**PROFILE_BODY, "website": "https:/example.com"},
        {**PROFILE_BODY, "userId": "another-user"},
        {**PROFILE_BODY, "user_id": "another-user"},
    ],
)
def test_put_profile_rejects_invalid_or_client_owned_fields(
    profile_repository: FakeProfileRepository,
    invalid_profile: dict[str, str],
) -> None:
    response = TestClient(app).put("/api/profile", headers=VALID_HEADERS, json=invalid_profile)

    assert response.status_code == 422
    assert profile_repository.rows == {}


def test_storage_errors_are_safe_and_do_not_confirm_success(profile_repository: FakeProfileRepository) -> None:
    profile_repository.fail_reads = True
    client = TestClient(app)

    read_response = client.get("/api/profile", headers=VALID_HEADERS)

    profile_repository.fail_reads = False
    profile_repository.fail_writes = True
    write_response = client.put("/api/profile", headers=VALID_HEADERS, json=PROFILE_BODY)

    assert read_response.status_code == 500
    assert write_response.status_code == 500
    assert "private database connection detail" not in read_response.text
    assert "private database connection detail" not in write_response.text
    assert profile_repository.rows == {}


def test_profile_validation_error_does_not_echo_personal_data(profile_repository: FakeProfileRepository) -> None:
    private_email = "PRIVATE_PROFILE_EMAIL"
    response = TestClient(app).put(
        "/api/profile",
        headers=VALID_HEADERS,
        json={**PROFILE_BODY, "email": private_email},
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_profile"
    assert private_email not in response.text
    assert profile_repository.rows == {}