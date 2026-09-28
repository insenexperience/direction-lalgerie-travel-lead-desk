import { redirect } from "next/navigation";
import { ProjetsView } from "@/components/bo3/vues";
import { donneesBo3 } from "@/lib/bo3/donnees";

export const dynamic = "force-dynamic";
export const metadata = { title: "Projets · Travel Lead Desk" };

export default async function LeadsPage() {
  const d = await donneesBo3();
  if (!d) redirect("/login");
  return <ProjetsView projets={d.projets} agences={d.agences} />;
}
