from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from fastapi.testclient import TestClient
import pytest

from app.api.jobs import get_match_service
from app.core.auth import require_user_id
from app.main import app
from app.models.match import MatchResult


RESUME_ID = str(UUID(int=91))
SEARCH_ID = str(UUID(int=92))
OFFER_ID = "linkedin:123"


def linkedin_result(partial: bool, can_recalculate: bool) -> MatchResult:
    return MatchResult(
        resumeChanged=False,
        completedAt=datetime(2026, 10, 8, tzinfo=timezone.utc),
        partial=partial,
        canRecalculate=can_recalculate,
        recommendations=[
            {
                "rank": 1,
                "offerId": OFFER_ID,
                "title": "Backend Developer",
                "company": "Acme",
                "location": "Buenos Aires",
                "url": "https://www.linkedin.com/jobs/view/123",
                "affinity": "Alta",
                "summary": "Experiencia alineada con el puesto.",
                "matches": ["Python"],
                "unmetRequirements": [],
                "missingInfo": [],
                "source": "LinkedIn",
                "alternateUrls": [{"source": "Jooble", "url": "https://ar.jooble.org/jdp/1"}],
                "descriptionIsPartial": True,
            }
        ],
    )


class FakeMatchService:
    partial = True
    can_recalculate = True

    async def run(self, user_id, request):
        return linkedin_result(self.partial, self.can_recalculate)

    async def get_saved(self, user_id, search_id, resume_id):
        return linkedin_result(self.partial, self.can_recalculate)


@pytest.fixture
def client():
    app.dependency_overrides[require_user_id] = lambda: "user-a"
    app.dependency_overrides[get_match_service] = FakeMatchService
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_post_match_returns_partial_and_multi_source_fields(client):
    response = client.post("/api/jobs/match", json={"searchId": SEARCH_ID, "resumeId": RESUME_ID})

    assert response.status_code == 200
    body = response.json()
    assert body["partial"] is True
    assert body["canRecalculate"] is True
    recommendation = body["recommendations"][0]
    assert recommendation["source"] == "LinkedIn"
    assert recommendation["descriptionIsPartial"] is True
    assert recommendation["alternateUrls"] == [
        {"source": "Jooble", "url": "https://ar.jooble.org/jdp/1"}
    ]


def test_get_match_returns_partial_flags(client):
    response = client.get(f"/api/jobs/match/{SEARCH_ID}", params={"resumeId": RESUME_ID})

    assert response.status_code == 200
    assert response.json()["partial"] is True
    assert response.json()["canRecalculate"] is True


def test_get_match_complete_search_is_not_partial(client, monkeypatch):
    monkeypatch.setattr(FakeMatchService, "partial", False)
    response = client.get(f"/api/jobs/match/{SEARCH_ID}", params={"resumeId": RESUME_ID})

    assert response.json()["partial"] is False


@pytest.mark.parametrize(
    "status_code,code",
    [(404, "search_not_found"), (409, "match_in_progress"), (504, "match_timeout")],
)
def test_post_match_preserves_error_codes(client, monkeypatch, status_code, code):
    async def fail(self, user_id, request):
        raise HTTPException(status_code=status_code, detail={"code": code, "message": "x"})

    monkeypatch.setattr(FakeMatchService, "run", fail)
    response = client.post("/api/jobs/match", json={"searchId": SEARCH_ID, "resumeId": RESUME_ID})

    assert response.status_code == status_code
    assert response.json()["detail"]["code"] == code
