import { connection } from "next/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KpiCard } from "@/components/ui/kpi-card";
import { StageDot } from "@/components/ui/stage-dot";
import type { LeadStatus } from "@/lib/mock-leads";
import { leadStatusLabelFr } from "@/lib/mock-leads";

export const dynamic = "force-dynamic";
export const revalidate = 60;

type PeriodKey = "7d" | "30d" | "quarter" | "ytd";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  "7d":      "7 jours",
  "30d":     "30 jours",
  "quarter": "Trimestre",
  "ytd":     "Depuis le début d'année",
};

function periodStart(key: PeriodKey): Date {
  const now = new Date();
  if (key === "7d")      return new Date(now.getTime() - 7  * 86400_000);
  if (key === "30d")     return new Date(now.getTime() - 30 * 86400_000);
  if (key === "quarter") return new Date(now.getTime() - 90 * 86400_000);
  // ytd: Jan 1 current year
  return new Date(now.getFullYear(), 0, 1);
}

function parseBudget(raw: string | null): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

function formatEur(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)} k€`;
  return `${Math.round(n)} €`;
}

const FUNNEL_STEPS: LeadStatus[] = [
  "new", "qualification", "agency_assignment", "co_construction", "quote", "negotiation", "won",
];

type PageProps = {
  searchParams: Promise<{ period?: string }>;
};

export default async function PilotagePage({ searchParams }: PageProps) {
  await connection();
  const params = await searchParams;
  const period = (params.period ?? "30d") as PeriodKey;
  const validPeriod = Object.keys(PERIOD_LABELS).includes(period) ? period : "30d";
  const since = periodStart(validPeriod);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // ── KPI queries ──────────────────────────────────────────────────────────
  const [pipelineRes, openLeadsRes, wonRes, closedRes, avgResponseRes, allLeadsRes] = await Promise.all([
    // Pipeline actif — open leads with budget
    supabase.from("leads").select("budget").not("status", "in", '("won","lost")'),
    // Open count
    supabase.from("leads").select("*", { count: "exact", head: true }).not("status", "in", '("won","lost")'),
    // Won in period
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "won").gte("updated_at", since.toISOString()),
    // Closed (won+lost) in period
    supabase.from("leads").select("*", { count: "exact", head: true }).in("status", ["won", "lost"]).gte("updated_at", since.toISOString()),
    // Avg first response (referent_assigned_at - created_at)
    supabase.from("leads").select("created_at, referent_assigned_at").not("referent_assigned_at", "is", null).gte("created_at", since.toISOString()).limit(500),
    // All leads for funnel
    supabase.from("leads").select("status, budget"),
  ]);

  const pipelineTotal = (pipelineRes.data ?? []).reduce((sum, r) => sum + parseBudget(r.budget as string), 0);
  const openLeads = openLeadsRes.count ?? 0;
  const wonCount = wonRes.count ?? 0;
  const closedCount = closedRes.count ?? 0;
  const conversionRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;

  const avgMinutes = (() => {
    const rows = avgResponseRes.data ?? [];
    if (!rows.length) return null;
    const diffs = rows.map((r) => {
      const created = new Date(r.created_at as string).getTime();
      const assigned = new Date(r.referent_assigned_at as string).getTime();
      return (assigned - created) / 60_000;
    }).filter((d) => d > 0 && d < 60 * 24);
    if (!diffs.length) return null;
    return Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
  })();

  // ── Funnel data ──────────────────────────────────────────────────────────
  const allLeads = allLeadsRes.data ?? [];
  const funnelData = FUNNEL_STEPS.map((status) => {
    const rows = allLeads.filter((r) => r.status === status);
    return {
      status,
      count: rows.length,
      budgetTotal: rows.reduce((sum, r) => sum + parseBudget(r.budget as string), 0),
    };
  });
  const funnelMax = Math.max(1, ...funnelData.map((d) => d.count));

  // ── 12-month revenue bars ─────────────────────────────────────────────────
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  const { data: wonLeads } = await supabase
    .from("leads")
    .select("budget, updated_at")
    .eq("status", "won")
    .gte("updated_at", twelveMonthsAgo.toISOString());

  const monthBuckets: Record<string, number> = {};
  for (let i = 0; i < 12; i++) {
    const d = new Date(twelveMonthsAgo);
    d.setMonth(d.getMonth() + i);
    monthBuckets[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
  }
  (wonLeads ?? []).forEach((lead) => {
    const d = new Date(lead.updated_at as string);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in monthBuckets) {
      monthBuckets[key] += parseBudget(lead.budget as string);
    }
  });
  const monthData = Object.entries(monthBuckets).map(([key, val]) => ({
    label: new Date(key + "-01").toLocaleDateString("fr-FR", { month: "short" }),
    value: val,
  }));
  const monthMax = Math.max(1, ...monthData.map((d) => d.value));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold text-[#0e1a21]">Pilotage business</h1>
          <p className="text-[13px] text-[#6b7a85]">Vue management — pipeline, conversion, agences</p>
        </div>

        {/* Period selector */}
        <div className="flex gap-1.5">
          {(Object.entries(PERIOD_LABELS) as [PeriodKey, string][]).map(([key, label]) => (
            <Link
              key={key}
              href={`/dashboard?period=${key}`}
              className={[
                "rounded-[6px] border px-3 py-1.5 text-[12px] font-medium transition-colors",
                validPeriod === key
                  ? "border-[#15323f] bg-[#15323f] text-white"
                  : "border-[#e4e8eb] text-[#3a4a55] hover:bg-[#f6f7f8]",
              ].join(" ")}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Pipeline actif"
          value={formatEur(pipelineTotal)}
          href="/leads"
          mono
        />
        <KpiCard
          label="Leads ouverts"
          value={openLeads}
          href="/leads"
        />
        <KpiCard
          label="Taux conversion"
          value={`${conversionRate} %`}
          mono
        />
        <KpiCard
          label="Délai 1ʳᵉ réponse"
          value={avgMinutes != null ? `${avgMinutes} min` : "—"}
          mono
        />
      </div>

      {/* Entonnoir + Top agences */}
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Funnel */}
        <section className="rounded-[8px] border border-[#e4e8eb] bg-white p-5">
          <h2 className="mb-4 text-[13px] font-semibold text-[#0e1a21]">Entonnoir de conversion</h2>
          <div className="flex flex-col gap-3">
            {funnelData.map(({ status, count, budgetTotal }) => (
              <Link
                key={status}
                href={`/leads?status=${status}`}
                className="group flex items-center gap-3 rounded-[6px] p-2 transition-colors hover:bg-[#f6f7f8]"
              >
                <StageDot status={status} />
                <span className="w-36 shrink-0 text-[13px] text-[#3a4a55]">
                  {leadStatusLabelFr[status]}
                </span>
                <div className="flex flex-1 items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f6f7f8]">
                    <div
                      className="h-full rounded-full bg-[#15323f] transition-all"
                      style={{ width: `${(count / funnelMax) * 100}%` }}
                      aria-hidden
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right font-mono text-[12px] font-medium text-[#0e1a21]">
                    {count}
                  </span>
                  {budgetTotal > 0 && (
                    <span className="w-20 shrink-0 text-right font-mono text-[11px] text-[#6b7a85]">
                      {formatEur(budgetTotal)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Agencies placeholder */}
        <section className="rounded-[8px] border border-[#e4e8eb] bg-white p-5">
          <h2 className="mb-4 text-[13px] font-semibold text-[#0e1a21]">Top agences partenaires</h2>
          <Link
            href="/agencies"
            className="flex items-center justify-center gap-2 py-10 text-[13px] text-[#1e5a8a] hover:underline"
          >
            Voir toutes les agences →
          </Link>
        </section>
      </div>

      {/* Revenue bars */}
      <section className="rounded-[8px] border border-[#e4e8eb] bg-white p-5">
        <h2 className="mb-4 text-[13px] font-semibold text-[#0e1a21]">Revenus gagnés — 12 derniers mois</h2>
        <div className="flex items-end gap-2" style={{ height: 120 }}>
          {monthData.map(({ label, value }) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-[3px] bg-[#15323f] transition-all"
                style={{ height: `${Math.max(2, (value / monthMax) * 96)}px` }}
                title={`${label} : ${formatEur(value)}`}
              />
              <span className="text-[10px] text-[#9aa7b0]">{label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
