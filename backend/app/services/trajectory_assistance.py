import logging
import re
import unicodedata

from pydantic import TypeAdapter, ValidationError

from app.models.trajectory_assistance import (
    AssistanceResult,
    AssistanceTurnRequest,
    FollowUpQuestion,
    NeedsInputResult,
    ReadyResult,
    TrajectoryProposal,
)
from app.services.azure_openai import AzureOpenAIError, AzureOpenAIProvider


class InvalidAssistanceResultError(Exception):
    pass


_ASSISTANCE_RESULT_ADAPTER = TypeAdapter(AssistanceResult)
logger = logging.getLogger(__name__)

_NON_WORD_PATTERN = re.compile(r"[^\w\s]", re.UNICODE)
_UNKNOWN_ANSWER_TEXTS = ("No conozco ese dato.", "No conozco esos datos.")


def _normalize_evidence(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    without_diacritics = "".join(char for char in decomposed if not unicodedata.combining(char))
    # Strip punctuation too, so minor formatting differences from the model don't break citation matching.
    without_punctuation = _NON_WORD_PATTERN.sub(" ", without_diacritics)
    return " ".join(without_punctuation.split())


def _has_unknown_answer(request: AssistanceTurnRequest) -> bool:
    unknown_answers = {_normalize_evidence(text) for text in _UNKNOWN_ANSWER_TEXTS}
    return any(
        _normalize_evidence(answer.answer) in unknown_answers
        for answer in request.answers
    )


class TrajectoryAssistanceService:
    def __init__(self, provider: AzureOpenAIProvider | None = None) -> None:
        self.provider = provider or AzureOpenAIProvider()

    async def assist(self, user_id: str, request: AssistanceTurnRequest) -> AssistanceResult:
        if not user_id:
            raise ValueError("Authenticated user is required")
        try:
            raw_result = await self.provider.generate_assistance_turn(request)
            raw_result = self._discard_invalid_proposals(raw_result)
            result = _ASSISTANCE_RESULT_ADAPTER.validate_python(raw_result)
        except AzureOpenAIError as exc:
            raise AzureOpenAIError("Azure OpenAI request failed") from exc
        except ValidationError as exc:
            logger.warning(
                "trajectory_assistance_invalid_shape issues=%s",
                [
                    {"location": error["loc"], "type": error["type"]}
                    for error in exc.errors(include_input=False)
                ],
            )
            raise InvalidAssistanceResultError("Assistance response is invalid") from exc

        user_declined_follow_up = _has_unknown_answer(request)
        if isinstance(result, NeedsInputResult) and user_declined_follow_up:
            return ReadyResult(state="ready", proposals=[], developmentRecommendations=[])

        if isinstance(result, ReadyResult):
            source_texts = [
                _normalize_evidence(source)
                for source in (request.sourceText, *(answer.answer for answer in request.answers))
            ]
            verified_proposals = []
            has_unverified_proposal = False
            for index, proposal in enumerate(result.proposals):
                if any(
                    not any(_normalize_evidence(evidence) in source for source in source_texts)
                    for evidence in proposal.evidence
                ):
                    logger.warning("trajectory_assistance_invalid_evidence proposal_index=%s", index)
                    has_unverified_proposal = True
                else:
                    verified_proposals.append(proposal)

            if has_unverified_proposal and user_declined_follow_up:
                return result.model_copy(update={"proposals": verified_proposals})
            if has_unverified_proposal:
                return NeedsInputResult(
                    state="needs_input",
                    questions=[
                        FollowUpQuestion(
                            id="evidence-clarification",
                            text=(
                                "No pude verificar una propuesta con la información aportada. "
                                "¿Puedes describir con tus propias palabras la tarea, responsabilidad "
                                "o resultado concreto que quieres incluir?"
                            ),
                        )
                    ],
                )

        return result

    @staticmethod
    def _discard_invalid_proposals(raw_result: dict) -> dict:
        if raw_result.get("state") != "ready" or not isinstance(raw_result.get("proposals"), list):
            return raw_result

        valid_proposals = []
        for index, proposal in enumerate(raw_result["proposals"]):
            try:
                valid_proposals.append(TrajectoryProposal.model_validate(proposal).model_dump())
            except ValidationError as exc:
                logger.warning(
                    "trajectory_assistance_invalid_proposal index=%s issues=%s",
                    index,
                    [
                        {"location": error["loc"], "type": error["type"]}
                        for error in exc.errors(include_input=False)
                    ],
                )

        return {**raw_result, "proposals": valid_proposals}