from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.profile import get_profile_repository
from app.core.supabase import get_auth_client
from app.main import app


USER_A = "00000000-0000-0000-0000-000000000001"
USER_B = "00000000-0000-0000-0000-000000000002"
PROFILE_A = {
    "fullName": "Ana García",
    "email": "ana.cv@example.com",
    "phone": "",
    "location": "Madrid",
    "linkedin": "",
    "website": "",
}
PROFILE_B = {
    "fullName": "Bea López",
    "email": "bea.cv@example.com",
    "phone": "",
    "location": "Valencia",
    "linkedin": "",
    "website": "",
}


class FakeAuth:
    user_ids = {"token-user-a": USER_A, "token-user-b": USER_B}

    def get_user(self, token: str) -> SimpleNamespace:
        user_id = self.user_ids.get(token)
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid access token")
        return SimpleNamespace(user=SimpleNamespace(id=user_id))


class FakeAuthClient:
    auth = FakeAuth()


class FakeProfileRepository:
    def __init__(self) -> None:
        self.rows: dict[str, dict[str, str]] = {}
        self.requested_user_ids: list[str] = []
        self.should_fail = False

    def get_by_user(self, user_id: str) -> dict[str, str] | None:
        self.requested_user_ids.append(user_id)
        if self.should_fail:
            raise RuntimeError("private storage details")
        return self.rows.get(user_id)

    def upsert(self, user_id: str, profile: dict[str, str]) -> dict[str, str]:
        self.requested_user_ids.append(user_id)
        if self.should_fail:
            raise RuntimeError("private storage details")
        self.rows[user_id] = profile
        return profile


@pytest.fixture
def profile_context() -> tuple[TestClient, FakeProfileRepository]:
    repository = FakeProfileRepository()
    app.dependency_overrides[get_auth_client] = lambda: FakeAuthClient()
    app.dependency_overrides[get_profile_repository] = lambda: repository
    yield TestClient(app), repository
    app.dependency_overrides.clear()


def test_profile_read_and_write_are_scoped_to_authenticated_user(
    profile_context: tuple[TestClient, FakeProfileRepository],
) -> None:
    client, repository = profile_context

    saved_a = client.put("/api/profile", headers={"Authorization": "Bearer token-user-a"}, json=PROFILE_A)
    read_b_before_save = client.get("/api/profile", headers={"Authorization": "Bearer token-user-b"})
    saved_b = client.put("/api/profile", headers={"Authorization": "Bearer token-user-b"}, json=PROFILE_B)
    read_a_after_b_save = client.get("/api/profile", headers={"Authorization": "Bearer token-user-a"})

    assert saved_a.status_code == 200
    assert read_b_before_save.json() is None
    assert saved_b.status_code == 200
    assert read_a_after_b_save.json() == PROFILE_A
    assert repository.rows == {USER_A: PROFILE_A, USER_B: PROFILE_B}
    assert repository.requested_user_ids == [USER_A, USER_B, USER_B, USER_A]


def test_invalid_bearer_never_reads_or_writes_profile(
    profile_context: tuple[TestClient, FakeProfileRepository],
) -> None:
    client, repository = profile_context

    response = client.put(
        "/api/profile",
        headers={"Authorization": "Bearer invalid-token"},
        json=PROFILE_A,
    )

    assert response.status_code == 401
    assert repository.requested_user_ids == []
    assert repository.rows == {}


def test_profile_storage_failure_is_mapped_without_details(
    profile_context: tuple[TestClient, FakeProfileRepository],
) -> None:
    client, repository = profile_context
    repository.should_fail = True

    response = client.get("/api/profile", headers={"Authorization": "Bearer token-user-a"})

    assert response.status_code == 500
    assert "private storage details" not in response.text