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
export type AssistantEdit = { kind: "note"; value: string } | { kind: "priority"; value: "normal" | "high" };
export type AssistantEditPreview = {
  leadId: string;
  updatedAt: string;
  edit: AssistantEdit;
  previous: string | null;
};

export function parseAssistantEdit(kind: unknown, value: unknown): AssistantEdit | null {
  if (kind === "priority" && (value === "normal" || value === "high")) return { kind, value };
  if (kind === "note" && typeof value === "string" && value.trim() && value.trim().length <= 2000) {
    return { kind, value: value.trim() };
  }
  return null;
}
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
