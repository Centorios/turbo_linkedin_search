import pytest

from app.models.trajectory_assistance import AssistanceTurnRequest
from app.services.azure_openai import AzureOpenAIError
from app.services.trajectory_assistance import (
    InvalidAssistanceResultError,
    TrajectoryAssistanceService,
)


class FakeAssistanceProvider:
    def __init__(self, results: list[dict] | None = None, error: Exception | None = None) -> None:
        self.results = list(results or [])
        self.error = error
        self.requests: list[AssistanceTurnRequest] = []

    async def generate_assistance_turn(self, request: AssistanceTurnRequest) -> dict:
        self.requests.append(request)
        if self.error:
            raise self.error
        return self.results.pop(0)


@pytest.mark.asyncio
async def test_turns_resend_source_and_confirmed_answers_in_order() -> None:
    provider = FakeAssistanceProvider(
        results=[
            {"state": "needs_input", "questions": [{"id": "q1", "text": "¿Qué resultado observaste?"}]},
            {
                "state": "ready",
                "proposals": [
                    {
                        "proposalId": "p1",
                        "kind": "achievement",
                        "text": "Coordiné la migración del proceso de facturación.",
                        "competencyType": None,
                        "evidence": ["Coordiné la migración del proceso de facturación."],
                    }
                ],
                "developmentRecommendations": [],
            },
        ]
    )
    service = TrajectoryAssistanceService(provider=provider)
    original_text = "Coordiné la migración del proceso de facturación."

    first = await service.assist("user-1",
        AssistanceTurnRequest.model_validate({"sourceText": original_text, "answers": []})
    )
    second = await service.assist("user-1",
        AssistanceTurnRequest.model_validate(
            {
                "sourceText": original_text,
                "answers": [
                    {
                        "questionId": "q1",
                        "question": "¿Qué resultado observaste?",
                        "answer": "Soporte reportó menos incidencias.",
                    }
                ],
            }
        )
    )

    assert first.state == "needs_input"
    assert second.state == "ready"
    assert provider.requests[0].sourceText == original_text
    assert provider.requests[1].answers[0].answer == "Soporte reportó menos incidencias."


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("source_text", "answer", "evidence"),
    [
        ("Coordiné un proyecto.", "", "Aumenté el ingreso 40%"),
    ],
)
async def test_ready_proposal_evidence_must_be_literal_user_input(
    source_text: str,
    answer: str,
    evidence: str,
) -> None:
    answers = []
    if answer:
        answers = [{"questionId": "q1", "question": "¿Qué resultado?", "answer": answer}]
    provider = FakeAssistanceProvider(
        results=[
            {
                "state": "ready",
                "proposals": [
                    {
                        "proposalId": "p1",
                        "kind": "achievement",
                        "text": "Aumenté los ingresos.",
                        "competencyType": None,
                        "evidence": [evidence],
                    }
                ],
                "developmentRecommendations": [],
            }
        ]
    )
    service = TrajectoryAssistanceService(provider=provider)

    with pytest.raises(InvalidAssistanceResultError):
        await service.assist("user-1",
            AssistanceTurnRequest.model_validate({"sourceText": source_text, "answers": answers})
        )


@pytest.mark.asyncio
async def test_evidence_may_come_from_a_prior_user_answer() -> None:
    answer = "Soporte recibió menos incidencias."
    provider = FakeAssistanceProvider(
        results=[
            {
                "state": "ready",
                "proposals": [
                    {
                        "proposalId": "p1",
                        "kind": "achievement",
                        "text": "Soporte recibió menos incidencias.",
                        "competencyType": None,
                        "evidence": [answer],
                    }
                ],
                "developmentRecommendations": [],
            }
        ]
    )
    service = TrajectoryAssistanceService(provider=provider)

    result = await service.assist("user-1",
        AssistanceTurnRequest.model_validate(
            {
                "sourceText": "Coordiné un proyecto.",
                "answers": [{"questionId": "q1", "question": "¿Qué resultado?", "answer": answer}],
            }
        )
    )

    assert result.state == "ready"


@pytest.mark.asyncio
async def test_provider_failure_is_propagated_as_safe_domain_error() -> None:
    provider = FakeAssistanceProvider(error=AzureOpenAIError("private provider detail"))
    service = TrajectoryAssistanceService(provider=provider)

    with pytest.raises(AzureOpenAIError) as error:
        await service.assist(
            "user-1",
            AssistanceTurnRequest.model_validate({"sourceText": "Trayectoria.", "answers": []}),
        )

    assert str(error.value) == "Azure OpenAI request failed"