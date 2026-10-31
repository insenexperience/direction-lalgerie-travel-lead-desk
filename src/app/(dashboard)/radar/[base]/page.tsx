import { notFound } from "next/navigation";
import { VueBase } from "@/components/radar/vue-base";
import { BASES, estBase } from "@/lib/radar/bases";
import { estIdNotion, sansTirets } from "@/lib/radar/notion-map";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ base: string }>; searchParams: Promise<{ statut?: string; fiche?: string }> };

export async function generateMetadata({ params }: Props) {
  const { base } = await params;
  return { title: `${estBase(base) ? BASES[base].label : "Radar"} · Radar · Travel Lead Desk` };
}

export default async function BaseRadarPage({ params, searchParams }: Props) {
  const { base } = await params;
  if (!estBase(base)) notFound();
  const sp = await searchParams;
  const fiche = estIdNotion(sp.fiche) ? sansTirets(sp.fiche) : undefined;
  return <VueBase key={base} base={base} statutInitial={typeof sp.statut === "string" ? sp.statut : undefined} ficheInitiale={fiche} />;
}
