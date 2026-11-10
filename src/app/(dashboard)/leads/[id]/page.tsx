import { cache, Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { FicheView } from "@/components/bo3/fiche";
import { contexteBo3 } from "@/lib/bo3/acces";
import { agencesBo3, maintenantBo3 } from "@/lib/bo3/donnees";
import { chargerProjetDepuisLigne, resoudreAgenceChoisie } from "@/lib/bo3/load";
import { loadDeskGmail } from "@/lib/email/desk-gmail-read";
import { mapRowToSupabaseLeadRow } from "@/lib/supabase-lead-detail-map";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };
const UUID_CANONIQUE = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

const ligneDossier = cache(async (identifiant: string) => {
  const ctx = await contexteBo3();
  if (!ctx) return null;
  const leads = () => ctx.supabase.from("leads").select("*").is("deleted_at", null);
  if (UUID_CANONIQUE.test(identifiant)) {
    const { data, error } = await leads().eq("id", identifiant).maybeSingle();
    if (error) throw new Error("Le dossier n’a pas pu être chargé.");
    if (data) return data;
  }
  const { data, error } = await leads().eq("reference", identifiant).maybeSingle();
  if (error) throw new Error("Le dossier n’a pas pu être chargé.");
  if (data) return data;

  // Les anciens dossiers sans référence utilisent DA- suivi des huit premiers caractères de l'UUID.
  const prefixe = /^DA-([0-9A-F]{8})$/.exec(identifiant)?.[1].toLowerCase();
  if (!prefixe) return null;
  const ancien = await leads().or('reference.is.null,reference.eq.""')
    .gte("id", `${prefixe}-0000-0000-0000-000000000000`)
    .lte("id", `${prefixe}-ffff-ffff-ffff-ffffffffffff`)
    .order("created_at", { ascending: false }).order("id").limit(1).maybeSingle();
  if (ancien.error) throw new Error("Le dossier n’a pas pu être chargé.");
  return ancien.data;
});

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const row = await ligneDossier(id);
  if (!row) return { title: "Projet" };
  const nom = row.traveler_name || row.email || "Voyageur";
  const ref = row.reference || `DA-${row.id.slice(0, 8).toUpperCase()}`;
  return { title: `${nom} · ${ref}` };
}

export default async function FichePage({ params }: Props) {
  const { id } = await params;
  const [ctx, row] = await Promise.all([contexteBo3(), ligneDossier(id)]);
  if (!ctx) redirect("/login");
  if (!row) notFound();
  const canReadGmail = !ctx.apercu && (ctx.role === "admin" || row.referent_id === ctx.userId);
  const [projet, agences, inbox] = await Promise.all([
    chargerProjetDepuisLigne(ctx, row),
    agencesBo3(),
    canReadGmail ? loadDeskGmail(ctx.supabase, row.id) : null,
  ]);
  const [p] = resoudreAgenceChoisie([projet], agences);
  const lead = mapRowToSupabaseLeadRow(row, true);
  const signature = ctx.nom.split(/\s+/)[0] || "L'équipe";
  return <Suspense><FicheView key={p.id} p={p} lead={lead} agences={agences} inboundMail={inbox?.ok ? inbox.messages : []} now={maintenantBo3()} signature={signature} /></Suspense>;
}
