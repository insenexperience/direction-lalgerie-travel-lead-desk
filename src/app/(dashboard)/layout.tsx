import type { ReactNode } from "react";
import { Cormorant_Garamond, Poppins } from "next/font/google";
import { redirect } from "next/navigation";
import { Bo3Shell, type DeskNavigationData } from "@/components/bo3/shell";
import { contexteBo3 } from "@/lib/bo3/acces";
import { donneesBo3 } from "@/lib/bo3/donnees";
import { defaultTab, statutLabel, travelerClock } from "@/lib/bo3/projet";
import { ZONES } from "@/lib/bo3/geo";
import "@/styles/bo3.css";
import "@/styles/desk-feedback.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-poppins", display: "swap" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["600", "700"], style: ["normal", "italic"], variable: "--font-cormorant", display: "swap" });

async function readNavigation(): Promise<DeskNavigationData> {
  const d = await donneesBo3();
  if (!d) return { counts: null, projets: [], agences: [] };
  const { projets, agences, now } = d;
  const ouverts = projets.filter((p) => p.statut !== "clos");
  return {
    counts: {
      file: ouverts.length,
      projets: projets.length,
      hot: ouverts.filter((p) => !p.premiereReponse && (travelerClock(p, now).rem ?? 0) < 12).length,
    },
    projets: projets.map((p) => ({ id: p.id, nom: p.nom, ref: p.ref, statut: statutLabel(p), titre: p.trame?.titre ?? null, tab: defaultTab(p), closed: p.statut === "clos" })),
    agences: agences.map((a) => ({ id: a.id, n: a.n, zones: a.zones.map((z) => ZONES[z]).join(", ") })),
  };
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const ctx = await contexteBo3();
  if (!ctx) redirect("/login");
  const navigation = readNavigation().catch((error: unknown): DeskNavigationData => {
    console.error("Navigation du Travel Lead Desk indisponible", error);
    return { counts: null, projets: [], agences: [], unavailable: true };
  });
  const initiales = ctx.nom.split(/[\s.@_-]+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "DA";

  return (
    <div className={`${poppins.variable} ${cormorant.variable}`}>
      <Bo3Shell
        navigation={navigation}
        user={{ nom: ctx.nom, role: ctx.role, initiales }}
        apercu={ctx.apercu}
      >
        {children}
      </Bo3Shell>
    </div>
  );
}
