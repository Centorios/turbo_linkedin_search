export type FollowUpAnswer = {
  questionId: string;
  question: string;
  answer: string;
};

export type AssistanceTurnRequest = {
  sourceText: string;
  answers: FollowUpAnswer[];
};

export type FollowUpQuestion = {
  id: string;
  text: string;
};

export type TrajectoryProposal = {
  proposalId: string;
  kind: "trajectory" | "achievement" | "competency";
  text: string;
  competencyType: "hard" | "soft" | null;
  evidence: string[];
};

export type DevelopmentRecommendation = {
  competency: string;
  reason: string;
  actions: string[];
};

export type NeedsInputResult = {
  state: "needs_input";
  questions: FollowUpQuestion[];
};

export type ReadyResult = {
  state: "ready";
  proposals: TrajectoryProposal[];
  developmentRecommendations: DevelopmentRecommendation[];
};

export type AssistanceResult = NeedsInputResult | ReadyResult;

export type ProposalDecision = {
  status: "proposed" | "accepted" | "edited" | "rejected";
  proposal: TrajectoryProposal;
  approvedText?: string;
};
