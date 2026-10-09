import pytest

from app.services.job_search_repository import offer_content_hash

from app.models.match import MatchRequest
from tests.integration.test_match_flow import (
    OFFER_ID,
    RESUME_ID,
    SEARCH_ID,
    SECOND_OFFER_ID,
    USER_ID,
    FakeAzureProvider,
    build_service,
    make_offer,
)


def linkedin_offer(offer_id: str):
    offer = make_offer(offer_id, "Backend Developer LinkedIn")
    offer.update(
        {
            "external_id": "linkedin:123",
            "source": "LinkedIn",
            "description": "Descripción completa del puesto con Python y FastAPI",
            "description_is_partial": True,
            "alternate_urls": [{"source": "Jooble", "url": "https://ar.jooble.org/jdp/9"}],
            "url": "https://www.linkedin.com/jobs/view/123",
        }
    )
    offer["content_hash"] = offer_content_hash(offer)
    return offer


def offers_from_both_sources():
    return [make_offer(OFFER_ID, "Desarrollador Python"), linkedin_offer(SECOND_OFFER_ID)]


def request():
    return MatchRequest(searchId=SEARCH_ID, resumeId=RESUME_ID)


@pytest.mark.asyncio
async def test_match_includes_offers_from_both_sources_with_metadata():
    provider = FakeAzureProvider(
        recommendations=[
            {
                "offerId": SECOND_OFFER_ID,
                "affinity": "Alta",
                "summary": "Encaja con el puesto.",
                "matches": ["Python"],
                "unmetRequirements": [],
                "missingInfo": [],
            }
        ]
    )
    service, _, _, azure, _ = build_service(offers_from_both_sources(), provider=provider)

    result = await service.run(USER_ID, request())

    recommendation = result.recommendations[0]
    assert recommendation.source == "LinkedIn"
    assert recommendation.descriptionIsPartial is True
    assert recommendation.alternateUrls[0].source == "Jooble"
    assert azure.analyze_calls == 1


@pytest.mark.asyncio
async def test_match_marks_partial_when_a_source_failed():
    service, jobs, _, _, _ = build_service(offers_from_both_sources())
    jobs.list_source_runs = lambda user_id, search_id: [
        {"source": "jooble", "status": "succeeded"},
        {"source": "linkedin", "status": "failed"},
    ]

    result = await service.run(USER_ID, request())

    assert result.partial is True
    assert result.canRecalculate is False


@pytest.mark.asyncio
async def test_match_allows_recalculate_when_linkedin_succeeded():
    service, jobs, _, _, _ = build_service(offers_from_both_sources())
    jobs.list_source_runs = lambda user_id, search_id: [
        {"source": "jooble", "status": "succeeded"},
        {"source": "linkedin", "status": "succeeded"},
    ]

    result = await service.run(USER_ID, request())

    assert result.partial is False
    assert result.canRecalculate is True
