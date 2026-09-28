import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FileView } from "@/components/bo3/file-view";
import { donneesBo3 } from "@/lib/bo3/donnees";

export const dynamic = "force-dynamic";
export const metadata = { title: "File de travail · Travel Lead Desk" };

export default async function InboxPage() {
  const d = await donneesBo3();
  if (!d) redirect("/login");
  return <Suspense><FileView projets={d.projets} agences={d.agences} now={d.now} /></Suspense>;
}
