import type { ReactNode } from "react";
import { LeadsDemoProvider } from "@/context/leads-demo-context";
import { getLeadsForWorkspace } from "@/lib/leads-server";
import type { MockLead } from "@/lib/mock-leads";

/** Sans ceci, Next peut mettre en cache le layout sans cookies → 0 lead côté RLS. */
export const dynamic = "force-dynamic";
export const revalidate = 30;

function leadsProviderKey(leads: MockLead[]) {
  if (!leads.length) return "empty";
  return leads
    .map((l) => `${l.id}:${l.status}:${l.referentId ?? ""}:${l.starred}`)
    .join("|");
}

export default async function LeadsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { leads, userId } = await getLeadsForWorkspace();

  return (
    <>
      <LeadsDemoProvider
        key={leadsProviderKey(leads)}
        initialLeads={leads}
        currentUserId={userId}
      >
        {children}
      </LeadsDemoProvider>
    </>
  );
}
