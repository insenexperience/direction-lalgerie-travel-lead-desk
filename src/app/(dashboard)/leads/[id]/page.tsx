import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { FicheView } from "@/components/bo3/fiche";
import { donneesBo3 } from "@/lib/bo3/donnees";

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
  const signature = d.ctx.nom.split(/\s+/)[0] || "L'équipe";
  return <Suspense><FicheView key={p.id} p={p} agences={d.agences} now={d.now} signature={signature} /></Suspense>;
}
