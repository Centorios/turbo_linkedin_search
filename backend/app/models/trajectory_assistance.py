from typing import Annotated, Literal

from pydantic import Field, StringConstraints, field_validator, model_validator

from app.models.cv import StrictModel


NonBlankString = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class FollowUpAnswer(StrictModel):
    questionId: NonBlankString
    question: NonBlankString
    answer: NonBlankString


class AssistanceTurnRequest(StrictModel):
    sourceText: str
    answers: list[FollowUpAnswer] = Field(default_factory=list)

    @field_validator("sourceText")
    @classmethod
    def validate_source_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("sourceText must not be blank")
        return value


class FollowUpQuestion(StrictModel):
    id: NonBlankString
    text: NonBlankString


class NeedsInputResult(StrictModel):
    state: Literal["needs_input"]
    questions: list[FollowUpQuestion] = Field(min_length=1, max_length=3)


class TrajectoryProposal(StrictModel):
    proposalId: NonBlankString
    kind: Literal["trajectory", "achievement", "competency"]
    text: NonBlankString
    competencyType: Literal["hard", "soft"] | None
    evidence: list[NonBlankString] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_competency_type(self) -> "TrajectoryProposal":
        if self.kind == "competency" and self.competencyType is None:
            raise ValueError("competency proposals require a competencyType")
        if self.kind != "competency" and self.competencyType is not None:
            raise ValueError("only competency proposals can define competencyType")
        return self


class DevelopmentRecommendation(StrictModel):
    competency: NonBlankString
    reason: NonBlankString
    actions: list[NonBlankString] = Field(min_length=1)


class ReadyResult(StrictModel):
    state: Literal["ready"]
    proposals: list[TrajectoryProposal]
    developmentRecommendations: list[DevelopmentRecommendation]


AssistanceResult = Annotated[NeedsInputResult | ReadyResult, Field(discriminator="state")]