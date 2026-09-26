import pytest

from app.models.trajectory_assistance import AssistanceTurnRequest
from app.services.trajectory_assistance import (
    InvalidAssistanceResultError,
    TrajectoryAssistanceService,
)


class FakeAssistanceProvider:
    def __init__(self, result: dict) -> None:
        self.result = result

    async def generate_assistance_turn(self, request: AssistanceTurnRequest) -> dict:
        return self.result


@pytest.mark.asyncio
async def test_demonstrated_competency_and_development_recommendation_remain_separate() -> None:
    evidence = "Coordiné la migración del sistema de facturación."
    provider = FakeAssistanceProvider(
        {
            "state": "ready",
            "proposals": [
                {
                    "proposalId": "competency-1",
                    "kind": "competency",
                    "text": "Coordinación de migraciones de sistemas",
                    "competencyType": "hard",
                    "evidence": [evidence],
                }
            ],
            "developmentRecommendations": [
                {
                    "competency": "Medición de resultados",
                    "reason": "No se aportó una métrica para el cambio.",
                    "actions": ["Definir una métrica previa y posterior a futuras migraciones."],
                }
            ],
        }
    )
    service = TrajectoryAssistanceService(provider=provider)

    result = await service.assist(
        "user-1",
        AssistanceTurnRequest.model_validate({"sourceText": evidence, "answers": []}),
    )

    assert result.state == "ready"
    assert result.proposals[0].kind == "competency"
    assert result.proposals[0].evidence == [evidence]
    assert result.developmentRecommendations[0].competency == "Medición de resultados"
    assert all(proposal.text != result.developmentRecommendations[0].competency for proposal in result.proposals)


@pytest.mark.asyncio
async def test_competency_without_evidence_from_user_is_rejected() -> None:
    provider = FakeAssistanceProvider(
        {
            "state": "ready",
            "proposals": [
                {
                    "proposalId": "competency-1",
                    "kind": "competency",
                    "text": "Análisis financiero avanzado",
                    "competencyType": "hard",
                    "evidence": ["Dominio avanzado de inversiones y balances."],
                }
            ],
            "developmentRecommendations": [],
        }
    )
    service = TrajectoryAssistanceService(provider=provider)

    with pytest.raises(InvalidAssistanceResultError):
        await service.assist(
            "user-1",
            AssistanceTurnRequest.model_validate(
                {"sourceText": "Coordiné un equipo de soporte.", "answers": []}
            ),
        )