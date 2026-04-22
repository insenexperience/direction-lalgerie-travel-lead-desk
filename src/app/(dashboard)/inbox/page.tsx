import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LEAD_SELECT_V2, LEAD_SELECT_LEGACY, mapRowToSupabaseLeadRow } from "@/lib/supabase-lead-detail-map";
import { isPostgresUndefinedColumnError } from "@/lib/supabase-schema-fallback";
import { InboxClientShell } from "@/components/leads/inbox-client-shell";
import { Chip } from "@/components/ui/chip";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";

export const dynamic = "force-dynamic";
export const revalidate = 30;

type QueueKey = "all" | "to_assign" | "validate_ai" | "mine" | "sla_risk" | "whatsapp";

const QUEUES: { key: QueueKey; label: string }[] = [
  { key: "mine",        label: "Mes dossiers" },
  { key: "to_assign",   label: "À assigner" },
  { key: "all",         label: "Tous" },
  { key: "validate_ai", label: "Validation IA" },
  { key: "sla_risk",    label: "SLA à risque" },
  { key: "whatsapp",    label: "WhatsApp" },
];

async function loadInbox(queue: QueueKey, userId: string, isAdmin: boolean) {
  await connection();
  const supabase = await createClient();

  let q = supabase
    .from("leads")
    .select(LEAD_SELECT_V2)
    .not("status", "in", '("won","lost")')
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });

  // "all" for non-admins: only unassigned + own leads (hide other operators' leads)
  if (queue === "all" && !isAdmin) q = q.or(`referent_id.is.null,referent_id.eq.${userId}`);
  if (queue === "to_assign")   q = q.is("referent_id", null);
  if (queue === "validate_ai") q = q.eq("qualification_validation_status", "pending");
  if (queue === "mine")        q = q.eq("referent_id", userId);
  if (queue === "sla_risk")    q = q.lt("created_at", new Date(Date.now() - 28 * 60 * 1000).toISOString()).is("referent_assigned_at", null);
  if (queue === "whatsapp")    q = q.eq("intake_channel", "whatsapp");

  let res = await q.limit(100);
  let schemaV2 = true;
  if (res.error && isPostgresUndefinedColumnError(res.error)) {
    schemaV2 = false;
    let q2 = supabase
      .from("leads")
      .select(LEAD_SELECT_LEGACY)
      .not("status", "in", '("won","lost")')
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true });
    if (queue === "all" && !isAdmin) q2 = q2.or(`referent_id.is.null,referent_id.eq.${userId}`);
    if (queue === "to_assign")   q2 = q2.is("referent_id", null);
    if (queue === "validate_ai") q2 = q2.eq("qualification_validation_status", "pending");
    if (queue === "mine")        q2 = q2.eq("referent_id", userId);
    if (queue === "sla_risk")    q2 = q2.lt("created_at", new Date(Date.now() - 28 * 60 * 1000).toISOString()).is("referent_assigned_at", null);
    if (queue === "whatsapp")    q2 = q2.eq("intake_channel", "whatsapp");
    res = await q2.limit(100);
  }
  if (res.error || !res.data) return [];
  return res.data.map((row) => mapRowToSupabaseLeadRow(row as unknown as Record<string, unknown>, schemaV2));
}

async function loadCounts(userId: string, isAdmin: boolean): Promise<Record<QueueKey, number>> {
  const supabase = await createClient();

  const baseAll = isAdmin
    ? supabase.from("leads").select("*", { count: "exact", head: true }).not("status", "in", '("won","lost")')
    : supabase.from("leads").select("*", { count: "exact", head: true }).not("status", "in", '("won","lost")').or(`referent_id.is.null,referent_id.eq.${userId}`);

  const [all, toAssign, validateAi, mine, slaRisk, whatsapp] = await Promise.all([
    baseAll,
    supabase.from("leads").select("*", { count: "exact", head: true }).not("status", "in", '("won","lost")').is("referent_id", null),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("qualification_validation_status", "pending"),
    supabase.from("leads").select("*", { count: "exact", head: true }).not("status", "in", '("won","lost")').eq("referent_id", userId),
    supabase.from("leads").select("*", { count: "exact", head: true }).not("status", "in", '("won","lost")').lt("created_at", new Date(Date.now() - 28 * 60 * 1000).toISOString()).is("referent_assigned_at", null),
    supabase.from("leads").select("*", { count: "exact", head: true }).not("status", "in", '("won","lost")').eq("intake_channel", "whatsapp"),
  ]);

  return {
    all:         all.count         ?? 0,
    to_assign:   toAssign.count    ?? 0,
    validate_ai: validateAi.count  ?? 0,
    mine:        mine.count        ?? 0,
    sla_risk:    slaRisk.count     ?? 0,
    whatsapp:    whatsapp.count    ?? 0,
  };
}

type InboxPageProps = {
  searchParams: Promise<{ queue?: string }>;
};

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const params = await searchParams;
  const queue = (params.queue ?? "mine") as QueueKey;
  const validQueue = QUEUES.some((q) => q.key === queue) ? queue : "mine";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const profileRes = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = (profileRes.data as { role?: string } | null)?.role === "admin";

  const [leads, counts] = await Promise.all([
    loadInbox(validQueue, user.id, isAdmin),
    loadCounts(user.id, isAdmin),
  ]);

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-4">
      {/* Page header */}
      <div>
        <h1 className="text-[19px] font-semibold text-[#0e1a21]">Inbox opérateur</h1>
        <p className="text-[13px] text-[#6b7a85]">Ce qui a besoin de vous</p>
      </div>

      {/* Queue chips */}
      <div className="flex flex-wrap gap-2">
        {QUEUES.map(({ key, label }) => (
          <Chip
            key={key}
            href={`/inbox?queue=${key}`}
            active={validQueue === key}
            count={counts[key]}
          >
            {label}
          </Chip>
        ))}
      </div>

      {/* Split panel */}
      <InboxClientShell
        leads={leads}
        queue={validQueue}
        currentUserId={user.id}
        isAdmin={isAdmin}
      />
    </div>
  );
}
