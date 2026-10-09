from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from fastapi.testclient import TestClient
import pytest

from app.api.jobs import (
    get_job_provider,
    get_job_search_repository,
    get_match_service,
    get_resume_repository,
)
from app.core.auth import require_user_id
from app.main import app
from app.models.jobs import JobListing
from app.models.match import MatchResult
from tests.contract.test_generate_cv import VALID_CV


RESUME_ID = str(UUID(int=71))
SEARCH_ID = str(UUID(int=72))
OFFER_ID = str(UUID(int=73))


class FakeResumeRepository:
    def get_by_id(self, user_id, resume_id):
        return {"data": VALID_CV}


class FakeProvider:
    async def search(self, keywords, location):
        return [
            JobListing(
                id="jooble:1",
                title="Desarrollador Python",
                company="Acme",
                location="Buenos Aires",
                snippet="Python y FastAPI",
                url="https://ar.jooble.org/jdp/1",
                source="Jooble",
            )
        ]


class FakeJobSearchRepository:
    def create_search(self, user_id, resume_id, keywords, location, offers):
        return SEARCH_ID


class FakeMatchService:
    async def run(self, user_id, request):
        return MatchResult(
            resumeChanged=False,
            completedAt=datetime(2026, 10, 8, tzinfo=timezone.utc),
            recommendations=[
                {
                    "rank": 1,
                    "offerId": OFFER_ID,
                    "title": "Desarrollador Python",
                    "company": "Acme",
                    "location": "Buenos Aires",
                    "url": "https://ar.jooble.org/jdp/1",
                    "affinity": "Alta",
                    "summary": "Experiencia alineada con el puesto.",
                    "matches": ["Python"],
                    "unmetRequirements": [],
                    "missingInfo": [],
                }
            ],
        )


@pytest.fixture
def context():
    app.dependency_overrides[require_user_id] = lambda: "user-a"
    app.dependency_overrides[get_resume_repository] = FakeResumeRepository
    app.dependency_overrides[get_job_provider] = FakeProvider
    app.dependency_overrides[get_job_search_repository] = FakeJobSearchRepository
    app.dependency_overrides[get_match_service] = FakeMatchService
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_match_returns_contract_result(context):
    response = context.post(
        "/api/jobs/match",
        json={"searchId": SEARCH_ID, "resumeId": RESUME_ID},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["resumeChanged"] is False
    assert body["recommendations"][0] == {
        "rank": 1,
        "offerId": OFFER_ID,
        "title": "Desarrollador Python",
        "company": "Acme",
        "location": "Buenos Aires",
        "url": "https://ar.jooble.org/jdp/1",
        "affinity": "Alta",
        "summary": "Experiencia alineada con el puesto.",
        "matches": ["Python"],
        "unmetRequirements": [],
        "missingInfo": [],
    }


@pytest.mark.parametrize(
    "status_code,detail",
    [
        (404, {"code": "search_not_found", "message": "La búsqueda no está disponible"}),
        (409, {"code": "match_in_progress", "message": "El análisis ya está en curso"}),
    ],
)
def test_match_preserves_contract_errors(context, monkeypatch, status_code, detail):
    async def fail(self, user_id, request):
        raise HTTPException(status_code=status_code, detail=detail)

    monkeypatch.setattr(FakeMatchService, "run", fail)
    response = context.post(
        "/api/jobs/match",
        json={"searchId": SEARCH_ID, "resumeId": RESUME_ID},
    )

    assert response.status_code == status_code
    assert response.json()["detail"] == detail


def test_match_rejects_invalid_payload_before_service(context):
    response = context.post(
        "/api/jobs/match",
        json={"searchId": "not-a-uuid", "resumeId": RESUME_ID},
    )

    assert response.status_code == 422


def test_search_returns_persisted_search_id(context):
    response = context.post(
        "/api/jobs/search",
        json={"resumeId": RESUME_ID, "keywords": "Python", "location": "Argentina"},
    )

    assert response.status_code == 200
    assert response.json()["searchId"] == SEARCH_ID
    assert len(response.json()["items"]) == 1


def test_match_requires_authentication():
    response = TestClient(app).post(
        "/api/jobs/match",
        json={"searchId": SEARCH_ID, "resumeId": RESUME_ID},
    )

    assert response.status_code == 401
