import { connection } from "next/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KpiCard } from "@/components/ui/kpi-card";
import { StageDot } from "@/components/ui/stage-dot";
import { AgencyLogo } from "@/components/agencies/agency-logo";
import { getAgencyLogoUrl } from "@/lib/agencies/logo-upload";
import type { LeadStatus } from "@/lib/mock-leads";
import { leadStatusLabelFr } from "@/lib/mock-leads";
import { DashboardTeamLoad } from "@/components/dashboard/dashboard-team-load";
import type { TeamLoadEntry } from "@/components/dashboard/dashboard-team-load";
import {
  calculateRawPipeline,
  calculateRawDaRevenue,
  calculateClosedRevenue,
  calculateLeadBudget,
  formatEur as formatEurCalc,
  type PipelineStages,
  type LeadForCalc,
} from "@/lib/pipeline-calculations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  return new Date(now.getFullYear(), 0, 1);
}

function formatEur(n: number): string {
  return formatEurCalc(n);
}

/** Bucket an array of { date: string } records into N equal time slices and return counts. */
function bucketByTime(dates: string[], from: Date, to: Date, buckets = 7): number[] {
  const span = to.getTime() - from.getTime();
  const bucketSize = span / buckets;
  const result = new Array<number>(buckets).fill(0);
  for (const d of dates) {
    const t = new Date(d).getTime();
    const idx = Math.min(buckets - 1, Math.floor((t - from.getTime()) / bucketSize));
    if (idx >= 0) result[idx]++;
  }
  return result;
}

const FUNNEL_STEPS: LeadStatus[] = [
  "new", "qualification", "agency_assignment", "co_construction", "quote", "negotiation", "won",
];

const FUNNEL_COLORS: Record<LeadStatus, string> = {
  new:               "#8896a0",
  qualification:     "#1e5a8a",
  agency_assignment: "#b68d3d",
  co_construction:   "#9a5fb4",
  quote:             "#d97706",
  negotiation:       "#c1411f",
  won:               "#0f6b4b",
  lost:              "#6b7a85",
};

type PageProps = {
  searchParams: Promise<{ period?: string }>;
};

export default async function PilotagePage({ searchParams }: PageProps) {
  await connection();
  const params = await searchParams;
  const period = (params.period ?? "30d") as PeriodKey;
  const validPeriod = Object.keys(PERIOD_LABELS).includes(period) ? period : "30d" as PeriodKey;
  const since = periodStart(validPeriod);
  const now = new Date();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // ── All queries in parallel ────────────────────────────────────────────────
  const [
    pipelineRes,
    openLeadsRes,
    wonRes,
    closedRes,
    avgResponseRes,
    allLeadsRes,
    periodLeadsRes,
    topAgenciesRes,
    wonLeadsRes,
    todayLeadsRes,
    teamLeadsRes,
  ] = await Promise.all([
    // Pipeline actif — open leads avec champs financiers structurés
    supabase.from("leads").select("budget_min, budget_unit, travelers_adults, travelers_children, status, deleted_at, created_at").not("status", "in", '("won","lost")').is("deleted_at", null),
    // Open count (hors supprimés)
    supabase.from("leads").select("*", { count: "exact", head: true }).not("status", "in", '("won","lost")').is("deleted_at", null),
    // Won in period
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "won").gte("updated_at", since.toISOString()),
    // Closed (won+lost) in period
    supabase.from("leads").select("*", { count: "exact", head: true }).in("status", ["won", "lost"]).gte("updated_at", since.toISOString()),
    // Avg first response (referent_assigned_at - created_at)
    supabase.from("leads").select("created_at, referent_assigned_at").not("referent_assigned_at", "is", null).gte("created_at", since.toISOString()).limit(500),
    // All leads for funnel (hors supprimés)
    supabase.from("leads").select("status, budget_min, budget_unit, travelers_adults, travelers_children, deleted_at").is("deleted_at", null),
    // Leads created in period for open-count sparkline
    supabase.from("leads").select("created_at").gte("created_at", since.toISOString()),
    // Top agencies: consultations in last 90 days with agency info
    supabase.from("consultations")
      .select("agency_id, status, agencies(id, legal_name, trade_name, logo_storage_path)")
      .gte("created_at", new Date(now.getTime() - 90 * 86400_000).toISOString()),
    // Won leads 12 months for revenue chart
    supabase.from("leads").select("budget_min, budget_unit, travelers_adults, travelers_children, deleted_at, status, updated_at").eq("status", "won").is("deleted_at", null).gte("updated_at", (() => {
      const d = new Date(); d.setMonth(d.getMonth() - 11); d.setDate(1); return d.toISOString();
    })()),
    // New leads today
    supabase.from("leads").select("*", { count: "exact", head: true })
      .gte("created_at", new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()),
    // Team load: active leads per referent (hors supprimés)
    supabase.from("leads")
      .select("referent_id, status, profiles!leads_referent_id_fkey(id, full_name, avatar_url)")
      .not("status", "in", '("won","lost")')
      .not("referent_id", "is", null)
      .is("deleted_at", null),
  ]);

  // ── Pipeline stages (pour les calculs pondérés) ────────────────────────────
  const { data: stagesData } = await supabase.from("pipeline_stages").select("code, weight, is_closed, is_won");
  const stages: PipelineStages = Object.fromEntries(
    (stagesData ?? []).map((s) => [s.code, { code: s.code, weight: Number(s.weight), is_closed: s.is_closed, is_won: s.is_won }])
  );

  // ── KPI values ──────────────────────────────────────────────────────────────
  const pipelineRows = (pipelineRes.data ?? []) as LeadForCalc[];
  const pipelineTotal = calculateRawPipeline(pipelineRows, stages);
  const daRevenue = calculateRawDaRevenue(pipelineRows, stages);
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

  // ── Sparkline data (7 buckets over the period) ─────────────────────────────
  const sparkPipeline = bucketByTime(
    pipelineRows.map((r) => (r as unknown as { created_at: string }).created_at),
    since, now
  );
  const sparkOpenLeads = bucketByTime(
    (periodLeadsRes.data ?? []).map((r) => r.created_at as string),
    since, now
  );
  const sparkResponseTime = bucketByTime(
    (avgResponseRes.data ?? []).map((r) => r.created_at as string),
    since, now
  );
  // Conversion sparkline: daily won count as proxy
  const sparkConversion = bucketByTime(
    (avgResponseRes.data ?? []).map((r) => r.referent_assigned_at as string),
    since, now
  );

  // ── Funnel data ──────────────────────────────────────────────────────────────
  const allLeadsData = (allLeadsRes.data ?? []) as LeadForCalc[];
  const funnelData = FUNNEL_STEPS.map((status) => {
    const rows = allLeadsData.filter((r) => r.status === status);
    return {
      status,
      count: rows.length,
      budgetTotal: rows.reduce((sum, r) => sum + calculateLeadBudget(r), 0),
    };
  });
  const allLeads = allLeadsData;
  const funnelMax = Math.max(1, ...funnelData.map((d) => d.count));

  // ── Top agencies ──────────────────────────────────────────────────────────────
  type ConsultationRow = { agency_id: string; status: string; agencies: { id: string; legal_name: string; trade_name: string | null; logo_storage_path: string | null } | null };
  const consultations = (topAgenciesRes.data ?? []) as unknown as ConsultationRow[];

  const agencyMap = new Map<string, { name: string; logo_storage_path: string | null; total: number; accepted: number }>();
  for (const c of consultations) {
    if (!c.agencies) continue;
    const entry = agencyMap.get(c.agency_id) ?? { name: c.agencies.trade_name ?? c.agencies.legal_name, logo_storage_path: c.agencies.logo_storage_path, total: 0, accepted: 0 };
    entry.total++;
    if (c.status === "quote_received") entry.accepted++;
    agencyMap.set(c.agency_id, entry);
  }
  const topAgencies = [...agencyMap.entries()]
    .map(([id, d]) => ({ id, name: d.name, logoUrl: getAgencyLogoUrl(d.logo_storage_path), total: d.total, accepted: d.accepted, rate: d.total > 0 ? Math.round((d.accepted / d.total) * 100) : 0 }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 4);

  // ── 12-month revenue bars ──────────────────────────────────────────────────
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);

  const monthBuckets: Record<string, number> = {};
  for (let i = 0; i < 12; i++) {
    const d = new Date(twelveMonthsAgo);
    d.setMonth(d.getMonth() + i);
    monthBuckets[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
  }
  (wonLeadsRes.data ?? []).forEach((lead) => {
    const d = new Date((lead as unknown as { updated_at: string }).updated_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in monthBuckets) {
      monthBuckets[key] += calculateLeadBudget(lead as LeadForCalc);
    }
  });
  const monthData = Object.entries(monthBuckets).map(([key, val]) => ({
    key,
    label: new Date(key + "-01").toLocaleDateString("fr-FR", { month: "short" }),
    value: val,
  }));
  const monthMax = Math.max(1, ...monthData.map((d) => d.value));
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const todayLeads = todayLeadsRes.count ?? 0;

  void allLeads; // utilisé dans le JSX via funnelData

  // Delta strings
  const deltaPipeline = pipelineTotal > 0 ? `${formatEur(pipelineTotal)} · CA du voyage (budget total)` : undefined;
  const deltaOpenLeads = todayLeads > 0 ? `${todayLeads} nouveau${todayLeads > 1 ? "x" : ""} aujourd'hui` : undefined;
  const deltaConversion = conversionRate > 0 ? `sur ${closedCount} dossiers clôturés` : undefined;
  const SLA_MIN = 30;
  const deltaResponse = avgMinutes != null
    ? avgMinutes <= SLA_MIN
      ? `SLA ${SLA_MIN} min respecté`
      : `Dépassement SLA ${SLA_MIN} min`
    : undefined;
  const responseWarn = avgMinutes != null && avgMinutes > SLA_MIN;

  const currentMonthRevenue = monthBuckets[currentMonthKey] ?? 0;
  const revenueSubtitle = currentMonthRevenue > 0
    ? `Mois en cours : ${formatEur(currentMonthRevenue)}`
    : "Aucun dossier gagné ce mois";

  // ── Team load aggregation ────────────────────────────────────────────────────
  type TeamLeadRow = {
    referent_id: string;
    status: string;
    profiles: { id: string; full_name: string | null; avatar_url: string | null } | null;
  };
  const teamLeadRows = (teamLeadsRes.data ?? []) as unknown as TeamLeadRow[];
  const teamMap = new Map<string, TeamLoadEntry>();
  for (const row of teamLeadRows) {
    if (!row.referent_id || !row.profiles) continue;
    const existing = teamMap.get(row.referent_id) ?? {
      referentId: row.referent_id,
      fullName: row.profiles.full_name ?? "Opérateur",
      avatarUrl: row.profiles.avatar_url ?? null,
      totalActive: 0,
      byStatus: {},
    };
    existing.totalActive++;
    const s = row.status as LeadStatus;
    existing.byStatus[s] = (existing.byStatus[s] ?? 0) + 1;
    teamMap.set(row.referent_id, existing);
  }
  const teamEntries = [...teamMap.values()].sort((a, b) => b.totalActive - a.totalActive);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold text-[#0e1a21]">Pilotage business</h1>
          <p className="mt-0.5 text-[13px] text-[#6b7a85]">
            Performance commerciale · {now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} · Direction l&apos;Algérie
          </p>
        </div>
        {/* Period chips */}
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

      {/* KPI cards — 4 colonnes */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <KpiCard
          label="Pipeline actif"
          value={formatEur(pipelineTotal)}
          deltaText={deltaPipeline}
          deltaUp
          href="/leads"
          mono
          sparkData={sparkPipeline}
          sparkColor="#0f6b4b"
        />
        <KpiCard
          label="Leads ouverts"
          value={openLeads}
          deltaText={deltaOpenLeads}
          deltaUp={todayLeads > 0}
          href="/leads"
          sparkData={sparkOpenLeads}
          sparkColor="#1e5a8a"
        />
        <KpiCard
          label="Taux conversion"
          value={`${conversionRate} %`}
          deltaText={deltaConversion}
          deltaUp={conversionRate > 0}
          mono
          sparkData={sparkConversion}
          sparkColor="#0f6b4b"
        />
        <KpiCard
          label="CA Direction l'Algérie"
          value={formatEur(daRevenue)}
          deltaText={daRevenue > 0 ? "Commission 10 % · pipeline actif" : undefined}
          deltaUp={daRevenue > 0}
          href="/leads"
          mono
          sparkData={sparkPipeline}
          sparkColor="#1e5a8a"
        />
      </div>

      {/* Team load */}
      <DashboardTeamLoad entries={teamEntries} />

      {/* Entonnoir + Top agences */}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {/* Funnel card */}
        <div className="rounded-[8px] border border-[#e4e8eb] bg-white">
          <div className="flex items-start justify-between gap-2 border-b border-[#e4e8eb] px-4 py-3">
            <div>
              <p className="text-[13px] font-semibold text-[#0e1a21]">Entonnoir de conversion</p>
              <p className="mt-0.5 text-[11px] text-[#6b7a85]">Valeur et volume par étape · {PERIOD_LABELS[validPeriod]}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 p-4">
            {funnelData.map(({ status, count, budgetTotal }) => (
              <Link
                key={status}
                href={`/leads?status=${status}`}
                className="group flex items-center justify-between gap-3 rounded-[6px] px-2 py-1.5 transition-colors hover:bg-[#f6f7f8]"
              >
                <span className="w-[140px] shrink-0 text-[12.5px] font-semibold text-[#0e1a21]">
                  {leadStatusLabelFr[status]}
                </span>
                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f6f7f8]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(count / funnelMax) * 100}%`,
                        background: FUNNEL_COLORS[status as LeadStatus],
                      }}
                      aria-hidden
                    />
                  </div>
                </div>
                <span className="shrink-0 font-mono text-[12px] text-[#6b7a85]">
                  <span className="font-semibold text-[#0e1a21]">{count}</span> leads
                  {budgetTotal > 0 ? ` · ${formatEur(budgetTotal)}` : ""}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Top agencies card */}
        <div className="rounded-[8px] border border-[#e4e8eb] bg-white">
          <div className="flex items-start justify-between gap-2 border-b border-[#e4e8eb] px-4 py-3">
            <div>
              <p className="text-[13px] font-semibold text-[#0e1a21]">Top agences partenaires</p>
              <p className="mt-0.5 text-[11px] text-[#6b7a85]">Par taux d&apos;acceptation</p>
            </div>
            <Link href="/agencies" className="shrink-0 text-[11px] text-[#1e5a8a] hover:underline">
              Voir toutes →
            </Link>
          </div>
          <div className="p-4">
            {topAgencies.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[#9aa7b0]">
                Aucune consultation sur 90 jours
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-[#e4e8eb]">
                {topAgencies.map((agency) => (
                  <Link
                    key={agency.id}
                    href={`/agencies/${agency.id}`}
                    className="flex items-center gap-3 py-2.5 transition-colors hover:bg-[#f6f7f8] first:pt-0 last:pb-0 px-1 rounded-[4px]"
                  >
                    <AgencyLogo name={agency.name} logoUrl={agency.logoUrl} size={32} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-[#0e1a21]">{agency.name}</p>
                      <p className="text-[11px] text-[#6b7a85]">
                        {agency.total} dossiers · {agency.rate}% acceptation
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[13px] font-semibold text-[#0e1a21]">
                      {agency.accepted > 0 ? formatEur(agency.accepted * 10000) : "—"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Revenue bars — 12 mois */}
      <div className="rounded-[8px] border border-[#e4e8eb] bg-white">
        <div className="flex items-start justify-between gap-2 border-b border-[#e4e8eb] px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold text-[#0e1a21]">Revenus gagnés — 12 derniers mois</p>
            <p className="mt-0.5 text-[11px] text-[#6b7a85]">{revenueSubtitle}</p>
          </div>
        </div>
        <div className="px-4 pb-3 pt-4">
          <div className="flex items-end gap-2" style={{ height: 160 }}>
            {monthData.map(({ key, label, value }) => {
              const barH = Math.max(2, Math.round((value / monthMax) * 130));
              const isCurrent = key === currentMonthKey;
              return (
                <div key={key} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10.5px] font-semibold tabular-nums text-[#6b7a85]">
                    {value > 0 ? formatEur(value).replace(" €", "").replace(" ", "") : ""}
                  </span>
                  <div
                    className={`w-full rounded-t-[4px] transition-all ${isCurrent ? "bg-[#15323f]" : "bg-[#e8f0f9]"}`}
                    style={{ height: `${barH}px` }}
                    title={`${label} : ${formatEur(value)}`}
                  />
                  <span className="text-[10.5px] font-medium text-[#9aa7b0]">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
