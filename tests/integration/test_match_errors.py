import asyncio
import logging

from fastapi.testclient import TestClient
import pytest

from app.api.jobs import get_match_service
from app.core.auth import require_user_id
from app.main import app
from app.models.match import MatchRequest
from app.services.azure_openai import AzureOpenAIError
from app.services.match_service import MatchInProgress, MatchUnavailable
from tests.integration.test_match_flow import (
    OFFER_ID,
    RESUME_ID,
    SEARCH_ID,
    FakeAzureProvider,
    FakeMatchRepository,
    build_service,
    make_offer,
)


USER_ID = "00000000-0000-0000-0000-000000000081"
PRIVATE_USER_DATA = "PRIVATE_USER_DATA@example.test"


@pytest.fixture
def client():
    app.dependency_overrides[require_user_id] = lambda: USER_ID
    yield TestClient(app)
    app.dependency_overrides.clear()


def set_match_service(service):
    app.dependency_overrides[get_match_service] = lambda: service


def request_match(client, *, recalculate=False):
    return client.post(
        "/api/jobs/match",
        json={
            "searchId": SEARCH_ID,
            "resumeId": RESUME_ID,
            "recalculate": recalculate,
        },
    )


@pytest.mark.asyncio
async def test_timeout_keeps_saved_embeddings_and_previous_result(client, caplog):
    class SlowProvider(FakeAzureProvider):
        async def analyze_match(self, resume, candidates):
            await asyncio.sleep(1)
            return await super().analyze_match(resume, candidates)

    previous_result = {
        "resume_content_hash": "previous-resume-hash",
        "recommendations": [],
    }
    match_repository = FakeMatchRepository(candidate_ids=[OFFER_ID])
    match_repository.cached_result = previous_result.copy()
    service, job_repository, match_repository, _, _ = build_service(
        [make_offer(OFFER_ID, "Desarrollador Python")],
        provider=SlowProvider(),
        match_repository=match_repository,
    )
    service.settings.match_deadline_seconds = 0.3
    set_match_service(service)

    with caplog.at_level(logging.WARNING):
        response = request_match(client, recalculate=True)

    assert response.status_code == 504
    assert response.json()["detail"]["code"] == "match_timeout"
    assert len(match_repository.saved_resume_embeddings) == 1
    assert len(job_repository.saved_embeddings) == 1
    assert match_repository.saved_results == []
    assert match_repository.cached_result == previous_result
    assert PRIVATE_USER_DATA not in caplog.text


def test_azure_failure_returns_502_without_logging_personal_data(client, caplog):
    class FailedProvider(FakeAzureProvider):
        async def embed_texts(self, texts):
            raise AzureOpenAIError(PRIVATE_USER_DATA)

    service, _, _, _, _ = build_service(
        [make_offer(OFFER_ID, "Desarrollador Python")],
        provider=FailedProvider(),
    )
    set_match_service(service)

    with caplog.at_level(logging.WARNING):
        response = request_match(client)

    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "match_unavailable"
    assert PRIVATE_USER_DATA not in caplog.text


@pytest.mark.parametrize(
    "error,status_code",
    [
        (MatchUnavailable("database unavailable"), 503),
        (MatchInProgress(), 409),
    ],
)
def test_unavailable_and_in_progress_errors_have_structured_responses(
    client, monkeypatch, error, status_code
):
    service, _, _, _, _ = build_service([make_offer(OFFER_ID, "Desarrollador Python")])

    async def fail(user_id, request):
        raise error

    monkeypatch.setattr(service, "run", fail)
    set_match_service(service)

    response = request_match(client)

    expected_code = "match_in_progress" if status_code == 409 else "match_unavailable"
    assert response.status_code == status_code
    assert response.json()["detail"]["code"] == expected_code
    assert response.json()["detail"]["message"]
