import pytest

from app.models.match import MatchRequest
from app.services.azure_openai import MATCH_SYSTEM_PROMPT
from app.services.match_service import MatchUnavailable
from tests.integration.test_match_flow import (
    OFFER_ID,
    RESUME_ID,
    SEARCH_ID,
    SECOND_OFFER_ID,
    FakeAzureProvider,
    build_service,
    make_offer,
)


USER_ID = "00000000-0000-0000-0000-000000000081"


def recommendation(offer_id: str, affinity: str, summary: str):
    return {
        "offerId": str(offer_id),
        "affinity": affinity,
        "summary": summary,
        "matches": ["Python"],
        "unmetRequirements": [],
        "missingInfo": [],
    }


def test_match_prompt_requires_evidence_and_qualitative_affinity():
    assert "Never invent experience, skills, credentials or job requirements" in MATCH_SYSTEM_PROMPT
    assert "list that in missingInfo" in MATCH_SYSTEM_PROMPT
    assert "Do not give percentages or hiring probability" in MATCH_SYSTEM_PROMPT


@pytest.mark.asyncio
async def test_match_orders_recommendations_by_qualitative_affinity():
    offers = [
        make_offer(OFFER_ID, "Desarrollador Python"),
        make_offer(SECOND_OFFER_ID, "Ingeniero Backend"),
    ]
    provider = FakeAzureProvider(
        recommendations=[
            recommendation(SECOND_OFFER_ID, "Media", "Coincidencia parcial."),
            recommendation(OFFER_ID, "Alta", "Experiencia directamente alineada."),
        ]
    )
    service, _, match_repository, _, _ = build_service(offers, provider=provider)

    result = await service.run(
        USER_ID,
        MatchRequest(searchId=SEARCH_ID, resumeId=RESUME_ID),
    )

    assert [item.affinity for item in result.recommendations] == ["Alta", "Media"]
    assert [item["affinity"] for item in match_repository.saved_results[0]] == [
        "Alta",
        "Media",
    ]


@pytest.mark.asyncio
async def test_low_affinity_recommendation_is_rejected_without_persisting():
    service, _, match_repository, _, _ = build_service(
        [make_offer(OFFER_ID, "Desarrollador Python")],
        provider=FakeAzureProvider(
            recommendations=[
                recommendation(OFFER_ID, "Baja", "La afinidad es baja.")
            ]
        ),
    )

    with pytest.raises(MatchUnavailable):
        await service.run(
            USER_ID,
            MatchRequest(searchId=SEARCH_ID, resumeId=RESUME_ID),
        )

    assert match_repository.saved_results == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "summary",
    [
        "Afinidad del 85%.",
        "Probabilidad de contratación elevada.",
    ],
)
async def test_match_rejects_percentages_or_hiring_probability(summary):
    provider = FakeAzureProvider(
        recommendations=[recommendation(OFFER_ID, "Alta", summary)]
    )
    service, _, match_repository, _, _ = build_service(
        [make_offer(OFFER_ID, "Desarrollador Python")],
        provider=provider,
    )

    with pytest.raises(MatchUnavailable):
        await service.run(
            USER_ID,
            MatchRequest(searchId=SEARCH_ID, resumeId=RESUME_ID),
        )

    assert match_repository.saved_results == []
