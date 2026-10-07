import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { FicheView, type FeasibilityMessageSummary } from "@/components/bo3/fiche";
import { donneesBo3 } from "@/lib/bo3/donnees";
import { mapRowToSupabaseLeadRow } from "@/lib/supabase-lead-detail-map";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const d = await donneesBo3();
  const p = d?.projets.find((x) => x.id === id);
  return { title: p ? `${p.nom} · ${p.ref}` : "Projet" };
}

export default async function FichePage({ params }: Props) {
  const { id } = await params;
  const d = await donneesBo3();
  if (!d) redirect("/login");
  const p = d.projets.find((x) => x.id === id || x.ref === id);
  if (!p) notFound();
  const [{ data: row, error }, { data: studies, error: studyError }] = await Promise.all([
    d.ctx.supabase.from("leads").select("*").eq("id", p.id).single(),
    d.ctx.supabase.from("lead_email_messages").select("id,agency_id,status,subject,created_at,sent_at").eq("lead_id", p.id).eq("kind", "agency_feasibility").order("created_at", { ascending:false }).limit(40),
  ]);
  if (error || !row) throw new Error("Le dossier n’a pas pu être chargé.");
  if (studyError) throw new Error("L’historique des études agence n’a pas pu être chargé.");
  const lead = mapRowToSupabaseLeadRow(row, true);
  const signature = d.ctx.nom.split(/\s+/)[0] || "L'équipe";
  return <Suspense><FicheView key={p.id} p={p} lead={lead} agences={d.agences} feasibilityMessages={(studies ?? []) as FeasibilityMessageSummary[]} now={d.now} signature={signature} /></Suspense>;
}
