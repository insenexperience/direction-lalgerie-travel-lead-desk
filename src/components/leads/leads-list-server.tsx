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

const ALL_STATUSES: LeadStatus[] = [
  "new", "qualification", "agency_assignment", "co_construction",
  "quote", "negotiation", "won", "lost",
];

type LeadsListServerProps = {
  status?: string;
  referentMap: Record<string, string>;
};

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

const channelLabel: Record<string, string> = {
  web_form: "Formulaire",
  whatsapp: "WhatsApp",
  manual:   "Manuel",
};

export async function LeadsListServer({ status, referentMap }: LeadsListServerProps) {
  const supabase = await createClient();

  let schemaV2 = true;
  let q = supabase.from("leads").select(LEAD_SELECT_V2).order("created_at", { ascending: false }).limit(200);
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

  // Count per status
  const { data: counts } = await supabase
    .from("leads")
    .select("status");
  const countByStatus: Record<string, number> = {};
  (counts ?? []).forEach((r) => {
    const s = r.status as string;
    countByStatus[s] = (countByStatus[s] ?? 0) + 1;
  });
  const totalOpen = leads.filter((l) => l.status !== "won" && l.status !== "lost").length;
  const pipelineTotal = leads
    .filter((l) => l.status !== "won" && l.status !== "lost")
    .reduce((sum, l) => sum + parseBudget(l.budget), 0);

  const currentStatus = status ?? "all";

  return (
    <div className="space-y-4">
      {/* Sub-header */}
      <p className="text-[13px] text-[#6b7a85]">
        {leads.length} dossier{leads.length !== 1 ? "s" : ""}
        {pipelineTotal > 0 && ` · ${formatEur(pipelineTotal)} de pipeline visible`}
      </p>

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
            <a href="/leads" className="text-[12px] text-[#1e5a8a] underline underline-offset-2">
              Réinitialiser les filtres
            </a>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[8px] border border-[#e4e8eb] bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e4e8eb]">
                {["", "Voyageur", "Projet", "Étape", "Budget", "Dates", "Référent", "Canal", "Activité", ""].map((col, i) => (
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

      {/* Budget */}
      <td className="px-3 py-3 text-right">
        <span className="font-mono text-[12px] font-medium text-[#0e1a21]">{lead.budget || "—"}</span>
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
