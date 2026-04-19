export type TranscriptRole = "traveler" | "ai" | "operator";

export type TranscriptEntry = {
  ts: string;
  from: TranscriptRole;
  text: string;
};

export type ScoringWeights = {
  price?: number;
  activities?: number;
  coverage?: number;
  response_speed?: number;
};

export type QualificationPayload = Record<string, unknown>;

export type AgencyShortlistItem = {
  agency_id: string;
  ai_match_score: number;
  ai_match_rationale: string;
  ai_recommended: boolean;
};

export type ProposalComparisonItem = {
  proposal_id: string;
  ai_proposal_score: number;
  ai_proposal_rationale: string;
  ai_recommended: boolean;
};
