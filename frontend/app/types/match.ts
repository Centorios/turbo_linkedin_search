export type MatchAffinity = "Alta" | "Media";

export type MatchRecommendation = {
  rank: number;
  offerId: string;
  title: string;
  company: string;
  location: string;
  url: string;
  affinity: MatchAffinity;
  summary: string;
  matches: string[];
  unmetRequirements: string[];
  missingInfo: string[];
  source?: string;
  alternateUrls?: { source: string; url: string }[];
  descriptionIsPartial?: boolean;
};

export type MatchResult = {
  partial?: boolean;
  canRecalculate?: boolean;
  resumeChanged: boolean;
  completedAt: string;
  recommendations: MatchRecommendation[];
};

export type MatchRequest = {
  searchId: string;
  resumeId: string;
  recalculate: boolean;
};
