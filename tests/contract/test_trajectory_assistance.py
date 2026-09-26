import pytest
from pydantic import TypeAdapter, ValidationError

from app.models.trajectory_assistance import AssistanceResult, AssistanceTurnRequest


RESULT_ADAPTER = TypeAdapter(AssistanceResult)


def test_turn_request_accepts_source_text_without_prior_answers() -> None:
    request = AssistanceTurnRequest.model_validate(
        {"sourceText": "Lideré una migración de facturación.", "answers": []}
    )

    assert request.sourceText == "Lideré una migración de facturación."
    assert request.answers == []


def test_turn_request_accepts_ordered_answers() -> None:
    request = AssistanceTurnRequest.model_validate(
        {
            "sourceText": "Coordiné una migración.",
            "answers": [
                {
                    "questionId": "follow-up-1",
                    "question": "¿Qué cambió?",
                    "answer": "Se redujeron los errores reportados.",
                }
            ],
        }
    )

    assert request.answers[0].questionId == "follow-up-1"
    assert request.answers[0].answer == "Se redujeron los errores reportados."


@pytest.mark.parametrize(
    "invalid_payload",
    [
        {"sourceText": "  ", "answers": []},
        {"sourceText": "Trayectoria real.", "answers": [], "user_id": "another-user"},
        {
            "sourceText": "Trayectoria real.",
            "answers": [{"questionId": "q1", "question": "¿Qué?", "answer": "Sí."}],
            "userId": "another-user",
        },
    ],
)
def test_turn_request_rejects_empty_source_and_client_owned_fields(invalid_payload: dict) -> None:
    with pytest.raises(ValidationError):
        AssistanceTurnRequest.model_validate(invalid_payload)


def test_needs_input_result_accepts_at_most_three_questions() -> None:
    result = RESULT_ADAPTER.validate_python(
        {
            "state": "needs_input",
            "questions": [
                {"id": "q1", "text": "¿Qué hiciste?"},
                {"id": "q2", "text": "¿Con quién trabajaste?"},
                {"id": "q3", "text": "¿Qué resultado observaste?"},
            ],
        }
    )

    assert result.state == "needs_input"
    assert len(result.questions) == 3


def test_needs_input_result_rejects_more_than_three_questions() -> None:
    questions = [{"id": f"q{i}", "text": f"Pregunta {i}"} for i in range(4)]

    with pytest.raises(ValidationError):
        RESULT_ADAPTER.validate_python({"state": "needs_input", "questions": questions})


def test_ready_result_requires_evidence_for_factual_proposals() -> None:
    result = RESULT_ADAPTER.validate_python(
        {
            "state": "ready",
            "proposals": [
                {
                    "proposalId": "p1",
                    "kind": "achievement",
                    "text": "Coordiné una migración de facturación.",
                    "competencyType": None,
                    "evidence": ["Coordiné una migración de facturación."],
                }
            ],
            "developmentRecommendations": [],
        }
    )

    assert result.state == "ready"
    assert result.proposals[0].evidence == ["Coordiné una migración de facturación."]


@pytest.mark.parametrize(
    "result",
    [
        {"state": "ready", "proposals": [], "developmentRecommendations": [], "questions": []},
        {
            "state": "ready",
            "proposals": [
                {
                    "proposalId": "p1",
                    "kind": "competency",
                    "text": "Liderazgo",
                    "competencyType": "soft",
                    "evidence": [],
                }
            ],
            "developmentRecommendations": [],
        },
        {
            "state": "ready",
            "proposals": [],
            "developmentRecommendations": [
                {"competency": "Comunicación", "reason": "Mejora posible", "actions": []}
            ],
        },
    ],
)
def test_assistance_result_rejects_extra_state_or_missing_evidence(result: dict) -> None:
    with pytest.raises(ValidationError):
        RESULT_ADAPTER.validate_python(result)