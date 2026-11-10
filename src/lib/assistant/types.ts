export const ASSISTANT_DRAFT_KINDS = ["welcome", "qualification", "agency_feasibility", "agency_brief"] as const;
export const ASSISTANT_DRAFT_SAVED = "desk:assistant-draft-saved";
export const ASSISTANT_OPEN_COMPOSER = "desk:assistant-open-composer";
export type AssistantDraftKind = typeof ASSISTANT_DRAFT_KINDS[number];
export type AssistantStatus = {
  state: "disabled" | "unconfigured" | "connected" | "unavailable";
  enabled: boolean;
  testedAt: string | null;
};
export type AssistantTurn = { role: "user" | "assistant"; content: string };
export type AssistantBudget = {
  min: number | null;
  max: number | null;
  currency: string;
  unit: "per_person" | "total";
  includesFlights: boolean | null;
};
export type AssistantEdit =
  | { kind: "note"; value: string }
  | { kind: "priority"; value: "normal" | "high" }
  | { kind: "budget"; value: AssistantBudget };
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
  if (kind === "budget" && value && typeof value === "object" && !Array.isArray(value)) {
    const { min, max, currency, unit, includesFlights } = value as Record<string, unknown>;
    const amount = (entry: unknown): entry is number => typeof entry === "number" && entry > 0 &&
      entry <= 99999999.99 && Number(entry.toFixed(2)) === entry;
    if (Object.keys(value).length === 5 && (min === null || amount(min)) && (max === null || amount(max)) &&
        (min !== null || max !== null) && (min === null || max === null || max >= min) &&
        typeof currency === "string" && /^[A-Z]{3}$/.test(currency) && (unit === "per_person" || unit === "total") &&
        (includesFlights === null || typeof includesFlights === "boolean")) {
      return { kind, value: { min, max, currency, unit, includesFlights } };
    }
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
