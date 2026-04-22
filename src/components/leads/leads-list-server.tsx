import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LEAD_SELECT_V2, LEAD_SELECT_LEGACY, mapRowToSupabaseLeadRow } from "@/lib/supabase-lead-detail-map";
import { isPostgresUndefinedColumnError } from "@/lib/supabase-schema-fallback";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";
import type { LeadStatus } from "@/lib/mock-leads";
import { leadStatusLabelFr } from "@/lib/mock-leads";
import { StageDot } from "@/components/ui/stage-dot";
import { Pill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { formatDistanceToNow } from "@/lib/format-relative-time";
import {
  calculateClosedRevenue,
  calculateRawPipeline,
  calculateRawDaRevenue,
  calculateLeadBudget,
  formatEur,
  type PipelineStages,
} from "@/lib/pipeline-calculations";
import { displayLeadScore } from "@/lib/lead-score";

const ALL_STATUSES: LeadStatus[] = [
  "new", "qualification", "agency_assignment", "co_construction",
  "quote", "negotiation", "won", "lost",
];

type LeadsListServerProps = {
  status?: string;
  referentMap: Record<string, string>;
};

const channelLabel: Record<string, string> = {
  web_form: "Formulaire",
  whatsapp: "WhatsApp",
  manual:   "Manuel",
};

export async function LeadsListServer({ status, referentMap }: LeadsListServerProps) {
  const supabase = await createClient();

  let schemaV2 = true;
  let q = supabase
    .from("leads")
    .select(LEAD_SELECT_V2)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status && status !== "all") {
    q = q.eq("status", status);
  }

  let res = await q;
  if (res.error && isPostgresUndefinedColumnError(res.error)) {
    schemaV2 = false;
    let q2 = supabase.from("leads").select(LEAD_SELECT_LEGACY).order("created_at", { ascending: false }).limit(200);
    if (status && status !== "all") {
      q2 = q2.eq("status", status);
    }
    res = await q2;
  }

  const leads = (res.data ?? []).map((r) => mapRowToSupabaseLeadRow(r as unknown as Record<string, unknown>, schemaV2));

  // Charger pipeline_stages pour les calculs pondérés
  const { data: stagesData } = await supabase.from("pipeline_stages").select("code, weight, is_closed, is_won");
  const stages: PipelineStages = Object.fromEntries(
    (stagesData ?? []).map((s) => [s.code, s])
  );

  // KPIs calculés depuis le module centralisé
  const allLeads = leads.map((l) => ({
    budget_min: l.budget_min,
    budget_unit: l.budget_unit,
    travelers_adults: l.travelers_adults,
    travelers_children: l.travelers_children,
    status: l.status,
    deleted_at: l.deleted_at,
  }));

  const closedRevenue = calculateClosedRevenue(allLeads, stages);
  const travelVolume = calculateRawPipeline(allLeads, stages);
  const daRevenue = calculateRawDaRevenue(allLeads, stages);

  const totalOpen = allLeads.filter((l) => {
    const stage = stages[l.status];
    return stage ? !stage.is_closed : (l.status !== "won" && l.status !== "lost");
  }).length;
  const totalWon = allLeads.filter((l) => {
    const stage = stages[l.status];
    return stage ? stage.is_won : l.status === "won";
  }).length;

  // Diagnostic: leads without structured budget
  const leadsWithoutBudget = allLeads.filter(
    (l) => !l.deleted_at && l.budget_min == null
  ).length;
  const stagesOk = Object.keys(stages).length > 0;

  // Count per status (pour les tabs) — inclut les leads non supprimés
  const { data: counts } = await supabase
    .from("leads")
    .select("status")
    .is("deleted_at", null);
  const countByStatus: Record<string, number> = {};
  (counts ?? []).forEach((r) => {
    const s = r.status as string;
    countByStatus[s] = (countByStatus[s] ?? 0) + 1;
  });

  const currentStatus = status ?? "all";

  return (
    <div className="space-y-4">
      {/* KPIs — 3 indicateurs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[8px] border border-[#e4e8eb] bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9aa7b0]">Pipeline pondéré</p>
          <p className="mt-1 font-mono text-[20px] font-bold text-[#0e1a21]">{formatEur(travelVolume)}</p>
          <p className="mt-0.5 text-[11px] text-[#6b7a85]">{totalOpen} dossier{totalOpen !== 1 ? "s" : ""} actif{totalOpen !== 1 ? "s" : ""} · CA du voyage</p>
        </div>
        <div className="rounded-[8px] border border-[#e4e8eb] bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9aa7b0]">CA réalisé</p>
          <p className="mt-1 font-mono text-[20px] font-bold text-[#0f6b4b]">{formatEur(closedRevenue)}</p>
          <p className="mt-0.5 text-[11px] text-[#6b7a85]">{totalWon} dossier{totalWon !== 1 ? "s" : ""} gagné{totalWon !== 1 ? "s" : ""} · 10 % du voyage</p>
        </div>
        <div className="rounded-[8px] border border-[#e4e8eb] bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9aa7b0]">Volume Direction l&apos;Algérie</p>
          <p className="mt-1 font-mono text-[20px] font-bold text-[#1e5a8a]">{formatEur(daRevenue)}</p>
          <p className="mt-0.5 text-[11px] text-[#6b7a85]">10 % du CA voyage · prix du lead DA</p>
        </div>
      </div>

      {/* Diagnostic — affiché seulement si problème détecté */}
      {!stagesOk && (
        <div className="rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          ⚠ Table <code>pipeline_stages</code> vide — exécuter <code>npm run db:push</code> pour appliquer la migration.
        </div>
      )}
      {stagesOk && leadsWithoutBudget > 0 && (
        <div className="rounded-[6px] border border-[#e4e8eb] bg-[#f8f9fa] px-3 py-2 text-[12px] text-[#6b7a85]">
          ℹ {leadsWithoutBudget} dossier{leadsWithoutBudget > 1 ? "s" : ""} sans budget structuré — ouvrez chaque fiche et renseignez le montant + unité pour que le CA soit calculé.
        </div>
      )}

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1 border-b border-[#e4e8eb] pb-0">
        <TabLink
          href="/leads"
          active={currentStatus === "all"}
          label="Tous"
          count={(counts ?? []).length}
        />
        {ALL_STATUSES.map((s) => (
          <TabLink
            key={s}
            href={`/leads?status=${s}`}
            active={currentStatus === s}
            label={leadStatusLabelFr[s]}
            count={countByStatus[s] ?? 0}
            status={s}
          />
        ))}
      </div>

      {/* Table */}
      {leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-[#9aa7b0]">
          <p className="text-[14px] font-medium">
            {currentStatus === "all" ? "Aucun lead trouvé." : "Aucun résultat. Essayez un autre filtre."}
          </p>
          {currentStatus !== "all" && (
            <Link href="/leads" className="text-[12px] text-[#1e5a8a] underline underline-offset-2">
              Réinitialiser les filtres
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[8px] border border-[#e4e8eb] bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e4e8eb]">
                {["", "Voyageur", "Projet", "Étape", "Budget", "Dates", "Référent", "Canal", "Score", "Activité", ""].map((col, i) => (
                  <th
                    key={i}
                    className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#9aa7b0] first:w-1 last:w-20"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <LeadRow key={lead.id} lead={lead} referentLabel={referentMap[lead.referent_id ?? ""] ?? null} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BudgetCell({ lead }: { lead: SupabaseLeadRow }) {
  const budget = calculateLeadBudget({
    budget_min: lead.budget_min,
    budget_unit: lead.budget_unit,
    travelers_adults: lead.travelers_adults,
    travelers_children: lead.travelers_children,
    status: lead.status,
    deleted_at: lead.deleted_at,
  });

  let tooltip = "";
  if (lead.budget_unit === "per_person" && lead.budget_min) {
    const min = lead.budget_min;
    const adults = lead.travelers_adults;
    const children = lead.travelers_children;
    const parts: string[] = [];
    if (adults > 0) parts.push(`${adults} adulte${adults > 1 ? "s" : ""} × ${formatEur(min)}`);
    if (children > 0) parts.push(`${children} enfant${children > 1 ? "s" : ""} × ${formatEur(min)} × 0,5`);
    tooltip = parts.join(" + ") + ` = ${formatEur(budget)}`;
  } else if (lead.budget_unit === "total") {
    tooltip = `Budget total : ${formatEur(budget)}`;
  }

  return (
    <span
      className="font-mono text-[12px] font-medium text-[#0e1a21]"
      title={tooltip || undefined}
    >
      {budget > 0 ? formatEur(budget) : "—"}
    </span>
  );
}

function TabLink({ href, active, label, count, status }: { href: string; active: boolean; label: string; count: number; status?: LeadStatus }) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] font-medium transition-colors",
        active
          ? "border-[#15323f] text-[#0e1a21]"
          : "border-transparent text-[#6b7a85] hover:text-[#3a4a55]",
      ].join(" ")}
    >
      {status && <StageDot status={status} />}
      {label}
      {count > 0 && (
        <span className={`rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${active ? "bg-[#15323f] text-white" : "bg-[#f4f7fa] text-[#6b7a85]"}`}>
          {count}
        </span>
      )}
    </Link>
  );
}

function ScoreBadge({ lead }: { lead: SupabaseLeadRow }) {
  const score = displayLeadScore(lead);
  if (score === null) return <span className="text-[11px] text-[#c4cdd5]">—</span>;
  const cls = score >= 70
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : score >= 40
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-red-50 text-red-600 border-red-200";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums ${cls}`}>
      {score}
    </span>
  );
}

function LeadRow({ lead, referentLabel }: { lead: SupabaseLeadRow; referentLabel: string | null }) {
  const isHot = lead.priority === "high";

  return (
    <tr className="group relative border-b border-[#e4e8eb] last:border-0 transition-colors hover:bg-[#f6f7f8]">
      {/* Hot bar */}
      <td className="w-1 py-3 pl-0 pr-0">
        {isHot && (
          <div className="h-full w-[3px] rounded-r bg-[#c1411f]" style={{ minHeight: 40 }} aria-label="Priorité haute" />
        )}
      </td>

      {/* Voyageur */}
      <td className="px-3 py-3">
        <Link href={`/leads/${lead.id}`} className="flex items-center gap-2">
          <Avatar name={lead.traveler_name || "?"} size={30} gold />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-[#0e1a21]">{lead.traveler_name || "—"}</p>
            <p className="truncate text-[11px] text-[#6b7a85]">{lead.email}</p>
          </div>
        </Link>
      </td>

      {/* Projet */}
      <td className="max-w-[200px] px-3 py-3">
        <p className="line-clamp-2 text-[12px] text-[#3a4a55]">
          {lead.trip_summary || "—"}
        </p>
        {lead.travelers && (
          <p className="text-[11px] text-[#9aa7b0]">{lead.travelers}</p>
        )}
      </td>

      {/* Étape */}
      <td className="px-3 py-3">
        <span className="flex items-center gap-1.5 whitespace-nowrap rounded-[4px] border border-[#e4e8eb] px-2 py-1 text-[11px] font-medium text-[#3a4a55]">
          <StageDot status={lead.status} />
          {leadStatusLabelFr[lead.status]}
        </span>
      </td>

      {/* Budget calculé */}
      <td className="px-3 py-3 text-right">
        {lead.budget_min != null && lead.budget_unit ? (
          <BudgetCell lead={lead} />
        ) : (
          <span className="font-mono text-[12px] text-[#9aa7b0]">{lead.budget || "—"}</span>
        )}
      </td>

      {/* Dates */}
      <td className="px-3 py-3">
        <span className="text-[12px] text-[#6b7a85]">{lead.trip_dates || "—"}</span>
      </td>

      {/* Référent */}
      <td className="px-3 py-3">
        {referentLabel ? (
          <div className="flex items-center gap-1.5">
            <Avatar name={referentLabel} size={22} />
            <span className="text-[12px] text-[#3a4a55]">{referentLabel.split(" ")[0]}</span>
          </div>
        ) : (
          <Pill variant="warn">Non assigné</Pill>
        )}
      </td>

      {/* Canal */}
      <td className="px-3 py-3">
        <span className="text-[12px] text-[#6b7a85]">
          {channelLabel[lead.intake_channel ?? ""] ?? lead.intake_channel ?? "—"}
        </span>
      </td>

      {/* Score */}
      <td className="px-3 py-3">
        <ScoreBadge lead={lead} />
      </td>

      {/* Activité */}
      <td className="px-3 py-3">
        <span className="text-[12px] text-[#9aa7b0]">{formatDistanceToNow(lead.updated_at)}</span>
      </td>

      {/* Actions — revealed on hover */}
      <td className="px-3 py-3">
        <div className="hidden items-center gap-1 group-hover:flex">
          <Link
            href={`/leads/${lead.id}`}
            className="rounded-[4px] border border-[#e4e8eb] bg-white px-2 py-1 text-[11px] font-medium text-[#3a4a55] transition-colors hover:bg-[#f6f7f8]"
          >
            Ouvrir
          </Link>
        </div>
      </td>
    </tr>
  );
}
