import { redirect } from "next/navigation";
import { AgencesView } from "@/components/bo3/vues";
import { donneesBo3 } from "@/lib/bo3/donnees";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agences · Travel Lead Desk" };

export default async function AgencesPage() {
  const d = await donneesBo3();
  if (!d) redirect("/login");
  return <AgencesView projets={d.projets} agences={d.agences} now={d.now} />;
}
