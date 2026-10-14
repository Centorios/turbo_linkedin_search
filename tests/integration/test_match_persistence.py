from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
from uuid import UUID

from fastapi.testclient import TestClient
import pytest

from app.api.jobs import get_match_service
from app.core.auth import require_user_id
from app.main import app
from app.services.match_repository import resume_content_hash
from app.services.match_service import MatchService
from tests.contract.test_generate_cv import VALID_CV
from tests.integration.test_match_flow import (
    FakeAzureProvider,
    FakeMatchRepository,
    make_offer,
)


USER_ID = "00000000-0000-0000-0000-000000000081"
OTHER_USER_ID = "00000000-0000-0000-0000-000000000082"
RESUME_ID = str(UUID(int=81))
SEARCH_ID = str(UUID(int=82))
OFFER_ID = str(UUID(int=83))
COMPLETED_AT = "2026-10-08T00:00:00Z"


class PersistenceJobSearchRepository:
    def __init__(self, offers):
        self.search = {
            "id": SEARCH_ID,
            "user_id": USER_ID,
            "resume_id": RESUME_ID,
        }
        self.offers = deepcopy(offers)

    def get_search(self, user_id, search_id):
        if user_id == self.search["user_id"] and search_id == self.search["id"]:
            return self.search
        return None

    def list_offers(self, user_id, search_id):
        if self.get_search(user_id, search_id) is None:
            return []
        return deepcopy(self.offers)

    def list_source_runs(self, user_id, search_id):
        return []

    def save_offer_embeddings(self, vectors):
        for offer in self.offers:
            if offer["id"] in vectors:
                offer["embedding"] = vectors[offer["id"]]


class PersistenceResumeRepository:
    def __init__(self):
        self.data = {(USER_ID, RESUME_ID): deepcopy(VALID_CV)}

    def get_by_id(self, user_id, resume_id):
        data = self.data.get((user_id, resume_id))
        return {"data": deepcopy(data)} if data is not None else None


class PersistenceMatchRepository(FakeMatchRepository):
    def __init__(self, offers):
        super().__init__(candidate_ids=[offer["id"] for offer in offers])
        self.offers_by_id = {offer["id"]: offer for offer in offers}
        self.results = {}

    def save_result(self, user_id, search_id, resume_id, resume_hash, recommendations):
        saved_recommendations = []
        for rank, item in enumerate(recommendations, start=1):
            offer = self.offers_by_id[item["offer_id"]]
            saved_recommendations.append(
                {
                    "rank": rank,
                    "offer_id": item["offer_id"],
                    "affinity": item["affinity"],
                    "summary": item["summary"],
                    "matches": item["matches"],
                    "unmet_requirements": item["unmet_requirements"],
                    "missing_info": item["missing_info"],
                    "job_search_offers": {
                        "title": offer["title"],
                        "company": offer["company"],
                        "location": offer["location"],
                        "url": offer["url"],
                    },
                }
            )
        saved_result = {
            "resume_content_hash": resume_hash,
            "created_at": COMPLETED_AT,
            "recommendations": saved_recommendations,
        }
        self.results[(user_id, search_id, resume_id)] = saved_result
        self.saved_results.append(deepcopy(recommendations))

    def get_saved_result(self, user_id, search_id, resume_id):
        return deepcopy(self.results.get((user_id, search_id, resume_id)))


class VersionedAzureProvider(FakeAzureProvider):
    async def analyze_match(self, resume, candidates):
        self.analyze_calls += 1
        return {
            "recommendations": [
                {
                    "offerId": candidates[0]["id"],
                    "affinity": "Alta",
                    "summary": f"Resultado {self.analyze_calls}",
                    "matches": ["Python"],
                    "unmetRequirements": [],
                    "missingInfo": [],
                }
            ]
        }


@pytest.fixture
def persistence_context():
    offers = [make_offer(OFFER_ID, "Desarrollador Python")]
    job_repository = PersistenceJobSearchRepository(offers)
    resume_repository = PersistenceResumeRepository()
    match_repository = PersistenceMatchRepository(offers)
    provider = VersionedAzureProvider()
    service = MatchService(
        job_search_repository=job_repository,
        match_repository=match_repository,
        resume_repository=resume_repository,
        provider=provider,
        settings=SimpleNamespace(
            match_deadline_seconds=75,
            match_candidates_k=8,
            azure_openai_embedding_deployment="text-embedding-3-small",
            azure_openai_embedding_dimensions=1536,
        ),
    )
    current_user = {"id": USER_ID}
    app.dependency_overrides[require_user_id] = lambda: current_user["id"]
    app.dependency_overrides[get_match_service] = lambda: service
    yield TestClient(app), current_user, resume_repository, match_repository, provider
    app.dependency_overrides.clear()


def post_match(client, *, recalculate=False):
    return client.post(
        "/api/jobs/match",
        json={
            "searchId": SEARCH_ID,
            "resumeId": RESUME_ID,
            "recalculate": recalculate,
        },
    )


def get_match(client, search_id=SEARCH_ID):
    return client.get(
        f"/api/jobs/match/{search_id}",
        params={"resumeId": RESUME_ID},
    )


def test_get_match_returns_saved_recommendations(persistence_context):
    client, _, _, _, _ = persistence_context
    generated = post_match(client)
    response = get_match(client)

    assert generated.status_code == 200
    assert response.status_code == 200
    assert response.json()["resumeChanged"] is False
    assert response.json()["completedAt"] == COMPLETED_AT
    assert response.json()["recommendations"][0]["summary"] == "Resultado 1"


def test_recalculate_replaces_saved_recommendations(persistence_context):
    client, _, _, match_repository, provider = persistence_context
    assert post_match(client).status_code == 200

    response = post_match(client, recalculate=True)

    assert response.status_code == 200
    assert response.json()["recommendations"][0]["summary"] == "Resultado 2"
    assert len(match_repository.saved_results) == 2
    assert match_repository.results[(USER_ID, SEARCH_ID, RESUME_ID)]["recommendations"][0][
        "summary"
    ] == "Resultado 2"
    assert provider.analyze_calls == 2


def test_get_match_reports_when_resume_has_changed(persistence_context):
    client, _, resume_repository, _, _ = persistence_context
    assert post_match(client).status_code == 200

    edited_resume = deepcopy(VALID_CV)
    edited_resume["summary"] = "Resumen profesional actualizado"
    resume_repository.data[(USER_ID, RESUME_ID)] = edited_resume

    response = get_match(client)

    assert response.status_code == 200
    assert response.json()["resumeChanged"] is True
    assert response.json()["recommendations"][0]["summary"] == "Resultado 1"
    assert resume_content_hash(edited_resume) != resume_content_hash(VALID_CV)


def test_match_isolation_returns_the_same_not_found_response(persistence_context):
    client, current_user, _, _, _ = persistence_context
    current_user["id"] = OTHER_USER_ID
    other_users_search = get_match(client)
    current_user["id"] = USER_ID
    missing_search = get_match(client, str(UUID(int=999)))

    assert other_users_search.status_code == 404
    assert missing_search.status_code == 404
    assert other_users_search.json() == missing_search.json()
    assert other_users_search.json()["detail"]["code"] == "match_not_found"


def test_match_result_migrations_cascade_when_resume_is_deleted():
    migration_path = (
        Path(__file__).resolve().parents[2]
        / "backend"
        / "supabase"
        / "migrations"
        / "006_match_results.sql"
    )
    migration = migration_path.read_text(encoding="utf-8").lower()

    assert "resume_id uuid not null references public.resumes(id) on delete cascade" in migration
    assert "result_id uuid not null references public.match_results(id) on delete cascade" in migration
