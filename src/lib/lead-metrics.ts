import type { LeadStatus, MockLead } from "@/lib/mock-leads";
import { LEAD_PIPELINE, leadStatusLabelFr } from "@/lib/mock-leads";

export type PipelineCount = { status: LeadStatus; label: string; count: number };

export function computePipelineCounts(leads: MockLead[]): PipelineCount[] {
  const map = new Map<LeadStatus, number>();
  for (const s of LEAD_PIPELINE) map.set(s, 0);
  for (const l of leads) {
    map.set(l.status, (map.get(l.status) ?? 0) + 1);
  }
  return LEAD_PIPELINE.map((status) => ({
    status,
    label: leadStatusLabelFr[status],
    count: map.get(status) ?? 0,
  }));
}

export function computeLeadTotals(leads: MockLead[]) {
  const total = leads.length;
  const won = leads.filter((l) => l.status === "won").length;
  const lost = leads.filter((l) => l.status === "lost").length;
  const open = total - won - lost;
  const conversionRate = total > 0 ? Math.round((won / total) * 1000) / 10 : 0;
  const withConsultation = leads.filter(
    (l) => (l.agencyLinks?.length ?? 0) > 0,
  ).length;
  const withQuoteReceived = leads.filter((l) =>
    (l.agencyLinks ?? []).some((x) => x.status === "quote_received"),
  ).length;
  const retained = leads.filter((l) => l.retainedAgencyId).length;
  return {
    total,
    open,
    won,
    lost,
    conversionRate,
    withConsultation,
    withQuoteReceived,
    retained,
  };
}

/** Pour graphiques simples : volume par source (top 5 + Autres). */
export function computeSourceBreakdown(leads: MockLead[]) {
  const map = new Map<string, number>();
  for (const l of leads) {
    const s = l.source.trim() || "—";
    map.set(s, (map.get(s) ?? 0) + 1);
  }
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, 5);
  const rest = entries.slice(5).reduce((acc, [, n]) => acc + n, 0);
  if (rest > 0) top.push(["Autres", rest]);
  const max = Math.max(1, ...top.map(([, n]) => n));
  return { rows: top, max };
}
