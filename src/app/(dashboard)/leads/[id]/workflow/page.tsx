import { redirect } from "next/navigation";

/** L'écran de workflow (autopilote IA jamais branché) est retiré : tout se passe dans la fiche projet. */
export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/leads/${id}`);
}
