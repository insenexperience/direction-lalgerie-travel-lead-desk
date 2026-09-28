import { redirect } from "next/navigation";

/** Les métriques sont fusionnées dans le Pilotage. */
export default function MetricsPage() {
  redirect("/dashboard");
}
