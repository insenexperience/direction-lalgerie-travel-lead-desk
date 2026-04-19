import { labelCrmConversion, labelCrmFollowUp } from "@/lib/crm-fields";
import { leadStatusLabelFr } from "@/lib/mock-leads";
import type { LeadStatus } from "@/lib/mock-leads";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";

function row(label: string, value: string) {
  return (
    <div className="min-w-0 sm:col-span-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">{value || "—"}</dd>
    </div>
  );
}

type LeadReadOnlySummaryProps = {
  lead: SupabaseLeadRow;
  operatorLabel?: string | null;
  partnerAgencyLabel?: string | null;
};

export function LeadReadOnlySummary({
  lead,
  operatorLabel,
  partnerAgencyLabel,
}: LeadReadOnlySummaryProps) {
  const st = lead.status as LeadStatus;
  return (
    <section className="rounded-md border border-border bg-panel p-4 sm:p-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Synthèse (lecture seule)
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Étape :{" "}
        <span className="font-semibold text-foreground">{leadStatusLabelFr[st]}</span>
      </p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        {row("Opérateur assigné", operatorLabel ?? "—")}
        {row("Agence partenaire", partnerAgencyLabel ?? "—")}
        {row("Voyageur", lead.traveler_name)}
        {row("Email", lead.email)}
        {row("Téléphone", lead.phone)}
        {row("Source", lead.source)}
        {row("Canal d’entrée", lead.intake_channel ?? "—")}
        {row("WhatsApp (déd.)", lead.whatsapp_phone_number ?? "—")}
        {row("Priorité", lead.priority === "high" ? "Haute" : "Normale")}
        <div className="sm:col-span-2">{row("Projet", lead.trip_summary)}</div>
        <div className="sm:col-span-2">
          {row("Budget · style", `${lead.budget || "—"} · ${lead.travel_style || "—"}`)}
        </div>
        {row("Dates", lead.trip_dates)}
        {row("Voyageurs", lead.travelers)}
        <div className="sm:col-span-2">
          {row("Qualification", lead.qualification_summary)}
        </div>
        <div className="sm:col-span-2 border-t border-border/60 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pilotage CRM (express)
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {row("Conversion", labelCrmConversion(lead.crm_conversion_band))}
            {row("Relance", labelCrmFollowUp(lead.crm_follow_up_strategy))}
          </dl>
        </div>
        <div className="sm:col-span-2">{row("Notes internes", lead.internal_notes)}</div>
        {row("État devis (champ)", lead.quote_status)}
      </dl>
    </section>
  );
}
