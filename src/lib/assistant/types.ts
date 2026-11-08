export const ASSISTANT_DRAFT_KINDS = ["welcome", "qualification", "agency_brief"] as const;
export const ASSISTANT_DRAFT_SAVED = "desk:assistant-draft-saved";
export const ASSISTANT_OPEN_COMPOSER = "desk:assistant-open-composer";
export type AssistantDraftKind = typeof ASSISTANT_DRAFT_KINDS[number];
export type AssistantStatus = {
  state: "disabled" | "unconfigured" | "connected" | "unavailable";
  enabled: boolean;
  testedAt: string | null;
};
export type AssistantTurn = { role: "user" | "assistant"; content: string };
export type AssistantDraft = {
  leadId: string;
  kind: AssistantDraftKind;
  agencyId: string | null;
  proposalId: string | null;
  draftId: string | null;
  updatedAt: string | null;
  recipient: string;
  subject: string;
  bodyText: string;
  language: "fr" | "en";
};

export function isAssistantDraftKind(value: unknown): value is AssistantDraftKind {
  return ASSISTANT_DRAFT_KINDS.some((kind) => kind === value);
}
