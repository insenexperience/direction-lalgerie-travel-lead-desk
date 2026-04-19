import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkflowEmailDeliveryHints } from "@/lib/email/workflow-email-config";
import { isUuid } from "@/lib/is-uuid";
import { allocateLeadReferenceIfMissing } from "@/lib/lead-reference";
import { referentDisplayLabel } from "@/lib/referent-display";
import {
  LEAD_SELECT_LEGACY,
  LEAD_SELECT_V2,
  mapRowToSupabaseLeadRow,
} from "@/lib/supabase-lead-detail-map";
import { isPostgresUndefinedColumnError } from "@/lib/supabase-schema-fallback";
import { LeadCockpitShell } from "@/components/leads/lead-cockpit-shell";
import { LeadManualWorkflowForm } from "./lead-manual-workflow-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeadWorkflowManualPage({ params }: PageProps) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let schemaV2 = true;
  let leadRes = await supabase
    .from("leads")
    .select(LEAD_SELECT_V2)
    .eq("id", id)
    .maybeSingle();

  if (leadRes.error && isPostgresUndefinedColumnError(leadRes.error)) {
    schemaV2 = false;
    leadRes = await supabase
      .from("leads")
      .select(LEAD_SELECT_LEGACY)
      .eq("id", id)
      .maybeSingle();
  }

  const { data: leadRow, error } = leadRes;

  if (error) {
    throw new Error(
      `Chargement du lead impossible : ${error.message}. Vérifiez les migrations Supabase (workflow).`,
    );
  }

  if (!leadRow) {
    notFound();
  }

  let lead = mapRowToSupabaseLeadRow(leadRow as unknown as Record<string, unknown>, schemaV2);

  if (schemaV2) {
    try {
      const ref = await allocateLeadReferenceIfMissing(supabase, id);
      if (ref) lead = { ...lead, reference: ref };
    } catch {
      /* migration cockpit absente */
    }
  }

  const referentId = lead.referent_id;
  if (referentId !== user.id) {
    redirect(`/leads/${id}`);
  }

  if (lead.status !== "new") {
    redirect(`/leads/${id}`);
  }

  if (lead.workflow_launched_at) {
    redirect(`/leads/${id}`);
  }

  const { data: referentRows } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name", { ascending: true });

  const referents = referentRows ?? [];
  const selfProfile = referents.find((r) => r.id === user.id);
  const referentLabel = selfProfile
    ? referentDisplayLabel(selfProfile)
    : referentDisplayLabel({
        id: user.id,
        full_name: null,
        email: user.email ?? "",
      });

  let isAdmin = false;
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  isAdmin = me?.role === "admin";

  let qualificationValidatorLabel: string | null = null;
  if (lead.qualification_validated_by) {
    const v = referents.find((r) => r.id === lead.qualification_validated_by);
    qualificationValidatorLabel = v ? referentDisplayLabel(v) : null;
  }

  const title = lead.traveler_name || "Lead";
  const summary = lead.trip_summary.trim() || "—";
  const emailHints = getWorkflowEmailDeliveryHints();

  return (
    <LeadCockpitShell
      lead={lead}
      referentLabel={referentLabel}
      qualificationValidatorLabel={qualificationValidatorLabel}
      isAdmin={isAdmin}
      showFicheLink={false}
    >
      <Link
        href={`/leads/${id}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour à la fiche
      </Link>

      <div className="mx-auto max-w-xl rounded-md border border-border bg-panel p-5 sm:p-6">
        {emailHints.bannerMessage ? (
          <p
            className="mb-5 rounded-md border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950/90 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100/90"
            role="note"
          >
            {emailHints.bannerMessage}
          </p>
        ) : null}
        <p className="text-sm text-foreground/85">
          Workflow manuel — <strong className="text-foreground">{title}</strong> — {summary}
        </p>
        <dl className="mt-4 grid gap-2 text-sm text-muted-foreground">
          <div>
            <dt className="font-medium text-foreground/80">Période</dt>
            <dd>{lead.trip_dates.trim() || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground/80">Groupe</dt>
            <dd>{lead.travelers.trim() || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground/80">Style / budget</dt>
            <dd>
              {lead.travel_style.trim() || "—"} · {lead.budget.trim() || "—"}
            </dd>
          </div>
        </dl>

        <div className="mt-8 border-t border-border pt-8">
          <LeadManualWorkflowForm leadId={id} resendReady={emailHints.resendReady} />
        </div>
      </div>
    </LeadCockpitShell>
  );
}
