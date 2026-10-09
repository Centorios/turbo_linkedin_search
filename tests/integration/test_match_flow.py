from copy import deepcopy
from types import SimpleNamespace
from uuid import UUID

import pytest

from app.models.match import MatchRequest
from app.services.job_search_repository import offer_content_hash
from app.services.match_repository import resume_content_hash
from app.services.match_service import MatchService, MatchUnavailable
from tests.contract.test_generate_cv import VALID_CV


USER_ID = "00000000-0000-0000-0000-000000000081"
RESUME_ID = str(UUID(int=81))
SEARCH_ID = str(UUID(int=82))
OFFER_ID = str(UUID(int=83))
SECOND_OFFER_ID = str(UUID(int=84))


def make_offer(offer_id: str, title: str, embedding=None):
    offer = {
        "id": offer_id,
        "position": 0,
        "external_id": f"jooble:{offer_id}",
        "title": title,
        "company": "Acme",
        "location": "Buenos Aires",
        "snippet": "Python y FastAPI",
        "url": "https://ar.jooble.org/jdp/1",
        "content_hash": "",
        "embedding": embedding,
    }
    offer["content_hash"] = offer_content_hash(offer)
    return offer


class FakeJobSearchRepository:
    def __init__(self, offers):
        self.search = {"id": SEARCH_ID, "resume_id": RESUME_ID}
        self.offers = deepcopy(offers)
        self.saved_embeddings = []

    def get_search(self, user_id, search_id):
        return self.search if search_id == SEARCH_ID else None

    def list_offers(self, user_id, search_id):
        return deepcopy(self.offers)

    def save_offer_embeddings(self, vectors):
        self.saved_embeddings.append(deepcopy(vectors))
        for offer in self.offers:
            if offer["id"] in vectors:
                offer["embedding"] = vectors[offer["id"]]


class FakeMatchRepository:
    def __init__(self, resume_embedding=None, candidate_ids=None):
        self.resume_embedding = resume_embedding
        self.candidate_ids = (
            candidate_ids
            if candidate_ids is not None
            else [OFFER_ID, SECOND_OFFER_ID]
        )
        self.saved_resume_embeddings = []
        self.saved_results = []
        self.cached_result = None
        self.locked = False

    def get_resume_embedding(self, user_id, resume_id):
        return self.resume_embedding

    def save_resume_embedding(self, user_id, resume_id, content_hash, model, embedding):
        self.saved_resume_embeddings.append((content_hash, model, embedding))
        self.resume_embedding = {
            "content_hash": content_hash,
            "model": model,
            "embedding": embedding,
        }

    def match_candidates(self, search_id, resume_id, k):
        return [{"offer_id": offer_id, "similarity": 0.9} for offer_id in self.candidate_ids[:k]]

    def try_lock(self, search_id, resume_id):
        if self.locked:
            return False
        self.locked = True
        return True

    def release_lock(self, search_id, resume_id):
        self.locked = False

    def save_result(self, user_id, search_id, resume_id, resume_hash, recommendations):
        self.saved_results.append(deepcopy(recommendations))
        self.cached_result = {
            "resume_content_hash": resume_hash,
            "recommendations": [],
        }

    def get_saved_result(self, user_id, search_id, resume_id):
        return self.cached_result


class FakeResumeRepository:
    def get_by_id(self, user_id, resume_id):
        return {"data": deepcopy(VALID_CV)}


class FakeAzureProvider:
    def __init__(self, recommendations=None):
        self.embedding_batches = []
        self.recommendations = recommendations
        self.analyze_calls = 0

    async def embed_texts(self, texts):
        self.embedding_batches.append(texts)
        return [[float(index + 1)] * 1536 for index, _ in enumerate(texts)]

    async def analyze_match(self, resume, candidates):
        self.analyze_calls += 1
        if self.recommendations is not None:
            return {"recommendations": self.recommendations}
        return {
            "recommendations": [
                {
                    "offerId": candidates[0]["id"],
                    "affinity": "Alta",
                    "summary": "Experiencia alineada con el puesto.",
                    "matches": ["Python"],
                    "unmetRequirements": [],
                    "missingInfo": [],
                }
            ]
        }


def build_service(offers, provider=None, match_repository=None):
    cv_data = deepcopy(VALID_CV)
    cv_hash = resume_content_hash(cv_data)
    jobs = FakeJobSearchRepository(offers)
    matches = match_repository or FakeMatchRepository(
        candidate_ids=[str(offer["id"]) for offer in offers]
    )
    azure = provider or FakeAzureProvider()
    settings = SimpleNamespace(
        match_deadline_seconds=75,
        match_candidates_k=8,
        azure_openai_embedding_deployment="text-embedding-3-small",
        azure_openai_embedding_dimensions=1536,
    )
    service = MatchService(
        job_search_repository=jobs,
        match_repository=matches,
        resume_repository=FakeResumeRepository(),
        provider=azure,
        settings=settings,
    )
    return service, jobs, matches, azure, cv_hash


@pytest.mark.asyncio
async def test_missing_embeddings_are_batched_and_existing_embeddings_reused():
    offers = [
        make_offer(OFFER_ID, "Desarrollador Python", embedding=[0.1] * 1536),
        make_offer(SECOND_OFFER_ID, "Ingeniero Backend"),
    ]
    cv_hash = resume_content_hash(VALID_CV)
    match_repository = FakeMatchRepository(
        resume_embedding={
            "content_hash": cv_hash,
            "model": "text-embedding-3-small",
            "embedding": [0.2] * 1536,
        }
    )
    service, job_repository, match_repository, provider, _ = build_service(
        offers, match_repository=match_repository
    )

    result = await service.run(USER_ID, MatchRequest(searchId=SEARCH_ID, resumeId=RESUME_ID))
    assert len(result.recommendations) == 1
    assert len(provider.embedding_batches) == 1
    assert len(provider.embedding_batches[0]) == 1
    assert len(job_repository.saved_embeddings) == 1
    assert match_repository.saved_resume_embeddings == []
    assert provider.analyze_calls == 1

    await service.run(
        USER_ID,
        MatchRequest(searchId=SEARCH_ID, resumeId=RESUME_ID, recalculate=True),
    )
    assert len(provider.embedding_batches) == 1
    assert provider.analyze_calls == 2
    assert match_repository.saved_results[-1][0]["offer_id"] == OFFER_ID


@pytest.mark.asyncio
async def test_rejects_recommendation_for_offer_outside_search():
    service, _, _, provider, _ = build_service(
        [make_offer(OFFER_ID, "Desarrollador Python")],
        provider=FakeAzureProvider(
            recommendations=[
                {
                    "offerId": str(UUID(int=999)),
                    "affinity": "Alta",
                    "summary": "No debe persistirse.",
                    "matches": [],
                    "unmetRequirements": [],
                    "missingInfo": [],
                }
            ]
        ),
    )

    with pytest.raises(MatchUnavailable):
        await service.run(USER_ID, MatchRequest(searchId=SEARCH_ID, resumeId=RESUME_ID))
    assert provider.analyze_calls == 1


@pytest.mark.asyncio
async def test_zero_recommendations_are_valid_and_persisted():
    service, _, match_repository, provider, _ = build_service(
        [make_offer(OFFER_ID, "Desarrollador Python")],
        provider=FakeAzureProvider(recommendations=[]),
    )

    result = await service.run(USER_ID, MatchRequest(searchId=SEARCH_ID, resumeId=RESUME_ID))

    assert result.recommendations == []
    assert match_repository.saved_results == [[]]
    assert provider.analyze_calls == 1
