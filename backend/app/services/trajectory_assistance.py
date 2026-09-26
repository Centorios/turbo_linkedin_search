from pydantic import TypeAdapter, ValidationError

from app.models.trajectory_assistance import AssistanceResult, AssistanceTurnRequest, ReadyResult
from app.services.azure_openai import AzureOpenAIError, AzureOpenAIProvider


class InvalidAssistanceResultError(Exception):
    pass


_ASSISTANCE_RESULT_ADAPTER = TypeAdapter(AssistanceResult)


class TrajectoryAssistanceService:
    def __init__(self, provider: AzureOpenAIProvider | None = None) -> None:
        self.provider = provider or AzureOpenAIProvider()

    async def assist(self, user_id: str, request: AssistanceTurnRequest) -> AssistanceResult:
        if not user_id:
            raise ValueError("Authenticated user is required")
        try:
            raw_result = await self.provider.generate_assistance_turn(request)
            result = _ASSISTANCE_RESULT_ADAPTER.validate_python(raw_result)
        except AzureOpenAIError as exc:
            raise AzureOpenAIError("Azure OpenAI request failed") from exc
        except ValidationError as exc:
            raise InvalidAssistanceResultError("Assistance response is invalid") from exc

        if isinstance(result, ReadyResult):
            source_texts = [request.sourceText, *(answer.answer for answer in request.answers)]
            for proposal in result.proposals:
                if any(not any(evidence in source for source in source_texts) for evidence in proposal.evidence):
                    raise InvalidAssistanceResultError("Assistance evidence is invalid")

        return result