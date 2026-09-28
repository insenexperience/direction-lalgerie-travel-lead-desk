import { redirect } from "next/navigation";
import { PilotageView } from "@/components/bo3/vues";
import { donneesBo3 } from "@/lib/bo3/donnees";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pilotage · Travel Lead Desk" };

export default async function PilotagePage() {
  const d = await donneesBo3();
  if (!d) redirect("/login");
  return <PilotageView projets={d.projets} agences={d.agences} now={d.now} />;
}
