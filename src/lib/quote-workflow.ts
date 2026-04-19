export type QuoteWorkflowStatus =
  | "draft"
  | "sent"
  | "awaiting_response"
  | "renegotiation"
  | "won"
  | "lost"
  | "suspended";

const TERMINAL = new Set<QuoteWorkflowStatus>(["won", "lost", "suspended"]);

export const quoteWorkflowStatusLabelFr: Record<QuoteWorkflowStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  awaiting_response: "En attente (réponse voyageur)",
  renegotiation: "À renégocier",
  won: "Gagné",
  lost: "Perdu",
  suspended: "Suspendu",
};

export function coerceQuoteWorkflowStatus(v: unknown): QuoteWorkflowStatus {
  const s = typeof v === "string" ? v : "draft";
  const allowed: QuoteWorkflowStatus[] = [
    "draft",
    "sent",
    "awaiting_response",
    "renegotiation",
    "won",
    "lost",
    "suspended",
  ];
  return allowed.includes(s as QuoteWorkflowStatus) ? (s as QuoteWorkflowStatus) : "draft";
}

export function isTerminalQuoteWorkflow(w: QuoteWorkflowStatus): boolean {
  return TERMINAL.has(w);
}

/** Une fois gagné / perdu / suspendu, le statut devis ne change plus depuis l’UI standard. */
export function canChangeQuoteWorkflow(
  current: QuoteWorkflowStatus,
  next: QuoteWorkflowStatus,
): boolean {
  if (current === next) return true;
  if (isTerminalQuoteWorkflow(current)) return false;
  return true;
}

export function quoteWorkflowToLeadQuoteStatusFr(
  w: QuoteWorkflowStatus,
): string {
  return quoteWorkflowStatusLabelFr[w];
}
