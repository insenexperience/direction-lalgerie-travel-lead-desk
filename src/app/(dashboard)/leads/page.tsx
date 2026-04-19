import { Suspense } from "react";
import { LeadsPageInner } from "@/app/(dashboard)/leads/leads-page-inner";

function LeadsFallback() {
  return (
    <div className="space-y-4">
      <div className="h-24 animate-pulse rounded-md bg-panel-muted" />
      <div className="h-12 animate-pulse rounded-md bg-panel-muted" />
      <div className="h-64 animate-pulse rounded-md bg-panel-muted" />
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<LeadsFallback />}>
      <LeadsPageInner />
    </Suspense>
  );
}
