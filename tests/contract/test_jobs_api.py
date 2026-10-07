from copy import deepcopy
import json
from uuid import UUID

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.jobs import get_job_provider, get_resume_repository
from app.core.auth import require_user_id
from app.main import app
from app.models.jobs import JobListing
from app.services.jooble import JobSourceError, JobSourceUnconfigured, JoobleJobsProvider, normalize_jobs
from tests.contract.test_generate_cv import VALID_CV


RESUME_ID = str(UUID(int=61))
OTHER_ID = str(UUID(int=62))


class FakeRepository:
    def __init__(self, data=None):
        self.rows = {("user-a", RESUME_ID): {"data": deepcopy(data or VALID_CV)}}
        self.calls = []

    def get_by_id(self, user_id, resume_id):
        self.calls.append((user_id, resume_id))
        return self.rows.get((user_id, resume_id))


class FakeProvider:
    def __init__(self, jobs=None, error=None):
        self.jobs = jobs or []
        self.error = error
        self.calls = []

    async def search(self, keywords, location):
        self.calls.append((keywords, location))
        if self.error:
            raise self.error
        return self.jobs


@pytest.fixture
def context():
    cv = deepcopy(VALID_CV)
    cv["personalInfo"]["location"] = "Buenos Aires, Argentina"
    cv["experience"] = [{"title": "Desarrollador backend", "company": "Acme", "location": "", "startDate": "2022", "endDate": "", "achievements": []}]
    cv["skills"]["hard"] = ["Python", "FastAPI"]
    repository = FakeRepository(cv)
    provider = FakeProvider()
    app.dependency_overrides[require_user_id] = lambda: "user-a"
    app.dependency_overrides[get_resume_repository] = lambda: repository
    app.dependency_overrides[get_job_provider] = lambda: provider
    yield TestClient(app), repository, provider
    app.dependency_overrides.clear()


def test_search_profile_uses_validated_cv_and_does_not_expose_private_data(context):
    client, repository, _ = context
    response = client.get(f"/api/jobs/search-profile/{RESUME_ID}")
    assert response.status_code == 200
    assert response.json() == {
        "resumeId": RESUME_ID,
        "suggestedKeywords": "Desarrollador backend",
        "suggestedLocation": "Buenos Aires, Argentina",
        "skills": ["Python", "FastAPI"],
    }
    assert "ana@example.com" not in response.text
    assert repository.calls == [("user-a", RESUME_ID)]


def test_profile_falls_back_to_verified_skills_and_argentina(context):
    client, repository, _ = context
    repository.rows[("user-a", RESUME_ID)]["data"]["experience"] = []
    repository.rows[("user-a", RESUME_ID)]["data"]["personalInfo"]["location"] = ""
    response = client.get(f"/api/jobs/search-profile/{RESUME_ID}")
    assert response.json()["suggestedKeywords"] == "Python FastAPI"
    assert response.json()["suggestedLocation"] == "Argentina"


def test_foreign_resume_cannot_generate_profile_or_search(context):
    client, repository, provider = context
    profile = client.get(f"/api/jobs/search-profile/{OTHER_ID}")
    search = client.post("/api/jobs/search", json={"resumeId": OTHER_ID, "keywords": "Python", "location": "Argentina"})
    assert profile.status_code == search.status_code == 404
    assert profile.json() == search.json()
    assert provider.calls == []
    assert repository.calls == [("user-a", OTHER_ID), ("user-a", OTHER_ID)]


def test_search_sends_only_reviewed_terms_and_deduplicates(context):
    client, _, provider = context
    job = JobListing(id="jooble:1", title="Python Developer", company="Acme", location="Buenos Aires", snippet="Servicios", url="https://ar.jooble.org/jdp/1", source="Jooble", updatedAt=None)
    provider.jobs = [job, job]
    response = client.post("/api/jobs/search", json={"resumeId": RESUME_ID, "keywords": "  Python Developer  ", "location": "  Argentina  "})
    assert response.status_code == 200
    assert response.json()["items"] == [job.model_dump(mode="json")]
    assert provider.calls == [("Python Developer", "Argentina")]
    assert "ana@example.com" not in response.text


@pytest.mark.parametrize("error,code,status", [
    (JobSourceUnconfigured(), "jobs_not_configured", 503),
    (JobSourceError(), "jobs_source_failed", 502),
])
def test_source_errors_are_safe(context, error, code, status):
    client, _, provider = context
    provider.error = error
    response = client.post("/api/jobs/search", json={"resumeId": RESUME_ID, "keywords": "Python", "location": "Argentina"})
    assert response.status_code == status
    assert response.json()["detail"]["code"] == code


@pytest.mark.parametrize("keywords,location", [("", "Argentina"), ("Python", ""), ("x" * 121, "Argentina")])
def test_invalid_search_does_not_call_provider(context, keywords, location):
    client, repository, provider = context
    response = client.post("/api/jobs/search", json={"resumeId": RESUME_ID, "keywords": keywords, "location": location})
    assert response.status_code == 422
    assert provider.calls == repository.calls == []


def test_normalize_jobs_rejects_invalid_links_and_duplicate_ids():
    jobs = normalize_jobs({"jobs": [
        {"id": 1, "title": "Backend", "company": "Acme", "location": "CABA", "snippet": "<b>Python</b> &amp; APIs", "link": "https://ar.jooble.org/jdp/1"},
        {"id": 1, "title": "Duplicado", "link": "https://ar.jooble.org/jdp/1"},
        {"id": 2, "title": "Inseguro", "link": "javascript:alert(1)"},
        {"id": 3, "title": "", "link": "https://ar.jooble.org/jdp/3"},
        {"id": 4, "title": "Otro sitio", "link": "https://example.com/jdp/4"},
    ]})
    assert len(jobs) == 1
    assert jobs[0].snippet == "Python & APIs"


@pytest.mark.asyncio
async def test_regional_provider_sends_only_search_terms_and_reuses_cached_results(monkeypatch):
    requests = []

    def respond(request):
        requests.append(request)
        return httpx.Response(200, json={"jobs": [{"id": 7, "title": "Python", "link": "https://ar.jooble.org/jdp/7"}]})

    original_client = httpx.AsyncClient
    transport = httpx.MockTransport(respond)
    monkeypatch.setattr("app.services.jooble.httpx.AsyncClient", lambda **kwargs: original_client(transport=transport, **kwargs))
    provider = JoobleJobsProvider("regional-test-key")

    first = await provider.search("Python", "Argentina")
    second = await provider.search("Python", "Argentina")

    assert first == second and len(requests) == 1
    assert requests[0].url.host == "ar.jooble.org"
    assert json.loads(requests[0].content) == {
        "keywords": "Python", "location": "Argentina", "page": 1,
        "ResultOnPage": 20, "companysearch": False,
    }
