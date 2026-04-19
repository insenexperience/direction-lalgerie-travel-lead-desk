export type QuoteItemLine = {
  label: string;
  detail: string;
};

/**
 * Transforme le texte de proposition + infos lead en lignes affichables (PDF / UI).
 */
export function buildQuoteItemsFromProposal(params: {
  circuitTitle: string;
  circuitOutline: string;
  tripSummary: string;
  tripDates: string;
  budget: string;
}): QuoteItemLine[] {
  const items: QuoteItemLine[] = [];

  items.push({
    label: "Titre de la proposition",
    detail: params.circuitTitle.trim() || "—",
  });

  if (params.tripSummary.trim()) {
    items.push({
      label: "Résumé du besoin",
      detail: params.tripSummary.trim(),
    });
  }
  if (params.tripDates.trim()) {
    items.push({
      label: "Dates & durée",
      detail: params.tripDates.trim(),
    });
  }
  if (params.budget.trim()) {
    items.push({
      label: "Budget indicatif",
      detail: params.budget.trim(),
    });
  }

  const rawLines = params.circuitOutline
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let idx = 0;
  for (const line of rawLines) {
    idx += 1;
    const cleaned = line.replace(/^[-*•]\s*/, "").trim();
    if (!cleaned) continue;
    const isBullet = line !== cleaned;
    items.push({
      label: isBullet ? `Point ${idx}` : `Ligne ${idx}`,
      detail: cleaned,
    });
  }

  if (items.length <= 4 && rawLines.length === 0) {
    items.push({
      label: "Circuit",
      detail: "— (à compléter)",
    });
  }

  return items;
}
