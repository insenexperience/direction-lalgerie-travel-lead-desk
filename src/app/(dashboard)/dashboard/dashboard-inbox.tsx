import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type InboxLead = {
  id: string;
  traveler_name: string;
  confidence: number | null;
};

export async function DashboardInbox() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: qualRows } = await supabase
    .from("leads")
    .select("id, traveler_name, ai_qualification_confidence")
    .eq("qualification_validation_status", "pending")
    .not("ai_qualification_payload", "is", null)
    .order("ai_qualification_confidence", { ascending: false })
    .limit(12);

  const qualifications: InboxLead[] = (qualRows ?? []).map((r) => ({
    id: String(r.id),
    traveler_name: String(r.traveler_name ?? ""),
    confidence:
      r.ai_qualification_confidence != null
        ? Number(r.ai_qualification_confidence)
        : null,
  }));

  const { data: propAgg } = await supabase
    .from("lead_circuit_proposals")
    .select("lead_id")
    .eq("ai_suggested", true);

  const shortlistLeadIds = [...new Set((propAgg ?? []).map((p) => String(p.lead_id)))].slice(
    0,
    12,
  );

  let shortlists: InboxLead[] = [];
  if (shortlistLeadIds.length) {
    const { data: sl } = await supabase
      .from("leads")
      .select("id, traveler_name")
      .in("id", shortlistLeadIds);
    shortlists = (sl ?? []).map((r) => ({
      id: String(r.id),
      traveler_name: String(r.traveler_name ?? ""),
      confidence: null,
    }));
  }

  const { data: scored } = await supabase
    .from("lead_circuit_proposals")
    .select("lead_id")
    .not("ai_proposal_score", "is", null);

  const arbIds = [...new Set((scored ?? []).map((p) => String(p.lead_id)))].slice(0, 12);
  let arbitration: InboxLead[] = [];
  if (arbIds.length) {
    const { data: ar } = await supabase
      .from("leads")
      .select("id, traveler_name")
      .in("id", arbIds);
    arbitration = (ar ?? []).map((r) => ({
      id: String(r.id),
      traveler_name: String(r.traveler_name ?? ""),
      confidence: null,
    }));
  }

  if (
    qualifications.length === 0 &&
    shortlists.length === 0 &&
    arbitration.length === 0
  ) {
    return null;
  }

  function block(title: string, rows: InboxLead[]) {
    if (!rows.length) return null;
    return (
      <div className="rounded-md border border-border bg-panel p-4 sm:p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/leads/${r.id}`}
                className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-medium text-foreground hover:underline"
              >
                <span>{r.traveler_name || "Sans nom"}</span>
                {r.confidence != null ? (
                  <span className="text-xs text-muted-foreground">
                    confiance IA {(r.confidence * 100).toFixed(0)}%
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
        Inbox validation
      </h2>
      <div className="grid gap-4 lg:grid-cols-3">
        {block("Qualifications à valider", qualifications)}
        {block("Shortlists IA (dossiers)", shortlists)}
        {block("Propositions comparées", arbitration)}
      </div>
    </section>
  );
}
