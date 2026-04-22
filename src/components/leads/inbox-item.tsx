import Link from "next/link";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";
import { StageDot } from "@/components/ui/stage-dot";
import { Pill } from "@/components/ui/pill";
import { formatDistanceToNow } from "@/lib/format-relative-time";
import { displayLeadScore } from "@/lib/lead-score";

type InboxItemProps = {
  lead: SupabaseLeadRow;
  selected: boolean;
  onClick: () => void;
};

const channelLabel: Record<string, string> = {
  web_form:  "Formulaire",
  whatsapp:  "WhatsApp",
  manual:    "Manuel",
};

function scorePillClass(score: number): string {
  if (score >= 70) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 40) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-600 border-red-200";
}

export function InboxItem({ lead, selected, onClick }: InboxItemProps) {
  const isPendingValidation = lead.qualification_validation_status === "pending";
  const isHot = lead.priority === "high";
  const score = displayLeadScore(lead);

  return (
    <div
      className={[
        "group relative flex w-full flex-col gap-2 border-b border-[#e4e8eb] px-4 py-3.5 text-left transition-colors",
        selected ? "bg-[#15323f]/5" : "bg-white hover:bg-[#f6f7f8]",
      ].join(" ")}
    >
      {/* Hot indicator */}
      {isHot && (
        <span className="absolute inset-y-0 left-0 w-[3px] rounded-l bg-[#c1411f]" aria-hidden />
      )}

      {/* Clickable area for selection */}
      <button
        type="button"
        onClick={onClick}
        className="absolute inset-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15323f]/40 focus-visible:ring-inset"
        aria-selected={selected}
        aria-label={`Sélectionner ${lead.traveler_name || "ce lead"}`}
      />

      {/* Row 1: stage dot + name + time */}
      <div className="relative flex items-center gap-2">
        <StageDot status={lead.status} />
        <span className="flex-1 truncate text-[13px] font-semibold text-[#0e1a21]">
          {lead.traveler_name || "—"}
        </span>
        <span className="shrink-0 text-[11px] text-[#9aa7b0]">
          {formatDistanceToNow(lead.created_at)}
        </span>
        {isPendingValidation && (
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#1e5a8a]" aria-label="Validation IA en attente" />
        )}
      </div>

      {/* Row 2: summary */}
      <p className="relative line-clamp-2 text-[12px] leading-snug text-[#6b7a85]">
        {lead.trip_summary || lead.qualification_summary || "Aucun résumé disponible."}
      </p>

      {/* Row 3: meta chips */}
      <div className="relative flex flex-wrap items-center gap-1.5">
        {lead.intake_channel && (
          <Pill variant="neutral">{channelLabel[lead.intake_channel] ?? lead.intake_channel}</Pill>
        )}
        {lead.budget && (
          <Pill variant="neutral" className="font-mono">{lead.budget}</Pill>
        )}
        {lead.trip_dates && (
          <Pill variant="neutral">{lead.trip_dates}</Pill>
        )}
        {!lead.referent_id && (
          <Pill variant="warn">Non assigné</Pill>
        )}
        {score !== null && (
          <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${scorePillClass(score)}`}>
            {score}
          </span>
        )}
        {/* "Ouvrir la fiche" — relative z-index to appear above the invisible button overlay */}
        <Link
          href={`/leads/${lead.id}`}
          className="ml-auto shrink-0 rounded border border-[#e4e8eb] bg-white px-2 py-0.5 text-[10px] font-medium text-[#3a4a55] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#f6f7f8]"
          onClick={(e) => e.stopPropagation()}
        >
          Ouvrir →
        </Link>
      </div>
    </div>
  );
}
