from copy import deepcopy
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.api.generate_cv import get_generation_service
from app.api.resumes import get_resume_repository
from app.core.supabase import get_auth_client
from app.main import app
from app.services.cv_generation import CvGenerationService
from app.services.resume_repository import ResumeRepository
from tests.contract.test_generate_cv import FakeProvider, VALID_CV
from tests.integration.test_profile import FakeAuthClient, USER_A, USER_B


class MemoryClient:
    def __init__(self):
        self.rows = []
        self.queries = []
        self.fail = False

    def table(self, name):
        assert name == "resumes"
        query = MemoryQuery(self)
        self.queries.append(query)
        return query


class MemoryQuery:
    def __init__(self, client):
        self.client = client
        self.filters = []
        self.orders = []
        self.bounds = None
        self.single = False
        self.new_row = None

    def select(self, fields):
        return self

    def eq(self, field, value):
        self.filters.append((field, value))
        return self

    def order(self, field, desc=False):
        self.orders.append((field, desc))
        return self

    def range(self, start, end):
        self.bounds = (start, end)
        return self

    def maybe_single(self):
        self.single = True
        return self

    def insert(self, data):
        self.new_row = data
        return self

    def execute(self):
        if self.client.fail:
            raise RuntimeError("private-storage-secret")
        if self.new_row:
            row = {"id": str(UUID(int=len(self.client.rows) + 10)), "created_at": datetime.now(timezone.utc).isoformat(), **deepcopy(self.new_row)}
            self.client.rows.append(row)
            return SimpleNamespace(data=[deepcopy(row)])
        rows = [row for row in self.client.rows if all(row[field] == value for field, value in self.filters)]
        for field, descending in reversed(self.orders):
            rows = sorted(rows, key=lambda row: row[field], reverse=descending)
        if self.bounds:
            start, end = self.bounds
            rows = rows[start:end + 1]
        return SimpleNamespace(data=deepcopy(rows[0] if rows and self.single else None if self.single else rows))


def record(number, owner=USER_A, date="2026-09-30T12:00:00+00:00"):
    return {"id": str(UUID(int=number)), "user_id": owner, "request_id": str(UUID(int=number + 100)), "created_at": date, "data": deepcopy(VALID_CV)}


@pytest.fixture
def context():
    storage = MemoryClient()
    repository = ResumeRepository(client=storage)
    app.dependency_overrides[get_auth_client] = lambda: FakeAuthClient()
    app.dependency_overrides[get_resume_repository] = lambda: repository
    yield TestClient(app), storage, repository
    app.dependency_overrides.clear()


def auth(user="a"):
    return {"Authorization": f"Bearer token-user-{user}"}


def test_list_is_private_stable_and_paginated(context):
    client, storage, _ = context
    storage.rows = [record(1), record(2), record(3, USER_B), record(4, date="2026-09-29T12:00:00+00:00")]
    first = client.get("/api/resumes?limit=1", headers=auth())
    second = client.get("/api/resumes?limit=1&offset=1", headers=auth())
    third = client.get("/api/resumes?limit=1&offset=2", headers=auth())
    other = client.get("/api/resumes", headers=auth("b"))
    assert first.status_code == 200
    assert first.json()["items"][0]["id"] == record(2)["id"]
    assert second.json()["items"][0]["id"] == record(1)["id"]
    assert third.json()["items"][0]["id"] == record(4)["id"]
    assert [first.json()["hasMore"], second.json()["hasMore"], third.json()["hasMore"]] == [True, True, False]
    assert other.json()["items"][0]["id"] == record(3)["id"]
    assert "data" not in first.json()["items"][0]
    assert "user_id" not in first.text
    for query in storage.queries:
        assert any(field == "user_id" for field, _ in query.filters)
        assert query.orders == [("created_at", True), ("id", True)]
        assert query.bounds is not None


def test_empty_and_all_pages(context):
    client, storage, _ = context
    assert client.get("/api/resumes", headers=auth()).json() == {"items": [], "offset": 0, "limit": 20, "hasMore": False}
    storage.rows = [record(i) for i in range(1, 22)]
    first = client.get("/api/resumes", headers=auth()).json()
    last = client.get("/api/resumes?offset=20", headers=auth()).json()
    assert len(first["items"]) == 20 and first["hasMore"]
    assert len(last["items"]) == 1 and not last["hasMore"]


def test_detail_requires_owner_and_returns_original_snapshot(context):
    client, storage, _ = context
    storage.rows = [record(1), record(2, USER_B)]
    own = client.get(f"/api/resumes/{record(1)['id']}", headers=auth())
    foreign = client.get(f"/api/resumes/{record(2)['id']}", headers=auth())
    missing = client.get(f"/api/resumes/{str(UUID(int=999))}", headers=auth())
    assert own.status_code == 200 and own.json()["data"] == VALID_CV
    assert foreign.status_code == missing.status_code == 404
    assert foreign.json() == missing.json()
    assert all(("user_id", USER_A) in query.filters for query in storage.queries)


@pytest.mark.parametrize("path", ["/api/resumes", f"/api/resumes/{str(UUID(int=1))}"])
@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer invalid"}])
def test_invalid_session_never_queries_storage(context, path, headers):
    client, storage, _ = context
    assert client.get(path, headers=headers).status_code == 401
    assert not storage.queries


@pytest.mark.parametrize("query", ["limit=0", "limit=51", "offset=-1", "offset=100001", "limit=x"])
def test_pagination_limits(context, query):
    client, storage, _ = context
    assert client.get(f"/api/resumes?{query}", headers=auth()).status_code == 422
    assert not storage.queries


def test_invalid_uuid_and_storage_failures_are_safe(context):
    client, storage, _ = context
    assert client.get("/api/resumes/not-a-uuid", headers=auth()).status_code == 422
    storage.fail = True
    for path in ["/api/resumes", f"/api/resumes/{str(UUID(int=1))}"]:
        response = client.get(path, headers=auth())
        assert response.status_code == 500
        assert "private-storage-secret" not in response.text


def test_corrupt_stored_cv_is_not_returned(context):
    client, storage, _ = context
    storage.rows = [{**record(1), "data": {"private": "private-content"}}]
    for path in ["/api/resumes", f"/api/resumes/{record(1)['id']}"]:
        response = client.get(path, headers=auth())
        assert response.status_code == 500
        assert "private-content" not in response.text


def test_generate_then_retrieve_and_retry_without_mutating_snapshot(context):
    client, storage, repository = context
    provider = FakeProvider()
    profile = {**VALID_CV["personalInfo"], "fullName": "Nombre original"}
    service = CvGenerationService(provider=provider, repository=repository, profile_repository=SimpleNamespace(get_by_user=lambda _: profile))
    app.dependency_overrides[get_generation_service] = lambda: service
    request_headers = {**auth(), "Idempotency-Key": str(UUID(int=501))}
    generated = client.post("/api/generate-cv", headers=request_headers, json={"text": "Mi trayectoria"})
    assert generated.status_code == 200
    profile["fullName"] = "Nombre actualizado"
    retried = client.post("/api/generate-cv", headers=request_headers, json={"text": "Otro texto"})
    assert retried.json()["personalInfo"]["fullName"] == "Nombre actualizado"
    assert len(storage.rows) == provider.calls == 1
    listed = client.get("/api/resumes", headers=auth()).json()
    detail = client.get(f"/api/resumes/{listed['items'][0]['id']}", headers=auth()).json()
    assert detail["data"]["personalInfo"]["fullName"] == "Nombre original"
    assert listed["items"][0]["fullName"] == "Nombre original"
    assert provider.calls == 1
