import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import { TopHeader } from "@/components/top-header";
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

  const { data: row, error } = await supabase
    .from("leads")
    .select(
      "id, referent_id, status, workflow_launched_at, traveler_name, trip_summary, trip_dates, travelers, budget, travel_style",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Chargement du lead impossible : ${error.message}. Vérifiez les migrations Supabase (workflow).`,
    );
  }

  if (!row) {
    notFound();
  }

  const referentId = row.referent_id ? String(row.referent_id) : null;
  if (referentId !== user.id) {
    redirect(`/leads/${id}`);
  }

  const status = String(row.status ?? "new");
  if (status !== "new") {
    redirect(`/leads/${id}`);
  }

  if (row.workflow_launched_at) {
    redirect(`/leads/${id}`);
  }

  const title = String(row.traveler_name ?? "Lead");
  const summary = String(row.trip_summary ?? "").trim() || "—";

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-16">
      <Link
        href={`/leads/${id}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour à la fiche
      </Link>

      <TopHeader
        title="Workflow manuel"
        description={`${title} — ${summary}`}
      />

      <div className="rounded-md border border-border bg-panel p-5 sm:p-6">
        <p className="text-sm text-foreground/85">
          Résumé : <strong className="text-foreground">{title}</strong>
        </p>
        <dl className="mt-4 grid gap-2 text-sm text-muted-foreground">
          <div>
            <dt className="font-medium text-foreground/80">Période</dt>
            <dd>{String(row.trip_dates ?? "").trim() || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground/80">Groupe</dt>
            <dd>{String(row.travelers ?? "").trim() || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground/80">Style / budget</dt>
            <dd>
              {String(row.travel_style ?? "").trim() || "—"} ·{" "}
              {String(row.budget ?? "").trim() || "—"}
            </dd>
          </div>
        </dl>

        <div className="mt-8 border-t border-border pt-8">
          <LeadManualWorkflowForm leadId={id} />
        </div>
      </div>
    </div>
  );
}
