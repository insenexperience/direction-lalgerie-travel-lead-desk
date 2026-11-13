import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { RadarProvider } from "@/components/radar/contexte";
import { EtatRadar } from "@/components/radar/etat";
import { TiroirFiche } from "@/components/radar/fiche";
import { contexteBo3 } from "@/lib/bo3/acces";
import { chargerRadar } from "@/lib/radar/donnees";

export const dynamic = "force-dynamic";

/** Module Radar : les cinq bases Notion de veille et de réseau. */
export default async function RadarLayout({ children }: { children: ReactNode }) {
  if (!(await contexteBo3())) redirect("/login");
  const donnees = await chargerRadar();
  return (
    <RadarProvider donnees={donnees}>
      {donnees.ok ? children : <EtatRadar raison={donnees.raison} message={donnees.message} />}
      {donnees.ok && <TiroirFiche />}
    </RadarProvider>
  );
}
