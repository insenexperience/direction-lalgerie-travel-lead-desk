import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AgentRadar } from "@/components/radar/agent";
import { RadarProvider } from "@/components/radar/contexte";
import { EtatRadar } from "@/components/radar/etat";
import { TiroirFiche } from "@/components/radar/fiche";
import { donneesBo3 } from "@/lib/bo3/donnees";
import { chargerRadar } from "@/lib/radar/donnees";
import "@/styles/radar.css";

export const dynamic = "force-dynamic";

/** Module Radar : les cinq bases Notion de veille et de réseau, et l'agent DA. */
export default async function RadarLayout({ children }: { children: ReactNode }) {
  if (!(await donneesBo3())) redirect("/login");
  const donnees = await chargerRadar();
  return (
    <RadarProvider donnees={donnees}>
      {donnees.ok ? children : <EtatRadar raison={donnees.raison} message={donnees.message} />}
      {donnees.ok && <TiroirFiche />}
      {donnees.ok && <AgentRadar />}
    </RadarProvider>
  );
}
