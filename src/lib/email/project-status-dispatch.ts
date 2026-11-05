import type { SupabaseClient } from "@supabase/supabase-js";
import { buildProjectStatusEmail } from "@/lib/email/project-status-email";
import { receiptRecipient } from "@/lib/email/demande-receipt";
import { sendTransactionalHtmlEmail } from "@/lib/email/resend-client";
import { travelerProjectTracking } from "@/lib/traveler-project-tracking";

type Mail = NonNullable<ReturnType<typeof buildProjectStatusEmail>>;
type Event = {
  id: string; lead_id: string; recipient: string; previous_status: string; status: string;
  claimed_at: string; attempts: number; mail_payload: Mail | null;
};
type DeliveryState = "sent" | "failed" | "unknown" | "skipped";
const TABLE = "project_status_email_outbox";
const timeout = () => AbortSignal.timeout(5000);

/** Called only by the authenticated server endpoint, using a service-role client.
 * The database trigger records transitions in the same transaction as the lead.
 * Claiming is atomic; an uncertain delivery is never retried automatically.
 */
export async function dispatchProjectStatusEmails(db: SupabaseClient) {
  const totals = { claimed: 0, sent: 0, failed: 0, unknown: 0, skipped: 0 };
  if (process.env.PROJECT_STATUS_EMAILS_ENABLED?.trim() !== "true") return { ...totals, disabled: true };
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.RESEND_FROM_EMAIL?.trim()) {
    throw new Error("email_configuration_missing");
  }
  // Two sequential messages fit inside the route's 60s budget even when every
  // database/provider operation reaches its own timeout (5 + 2 * 21 seconds).
  const { data, error } = await db.rpc("claim_project_status_emails", { batch_size: 2 }).abortSignal(timeout());
  if (error) throw new Error("email_queue_unavailable");
  const events = (data ?? []) as Event[];
  totals.claimed = events.length;
  for (const event of events) {
    const finish = async (state: DeliveryState, errorCode: string | null, providerId: string | null = null) => {
      const now = new Date();
      const { data: updated, error: updateError } = await db.from(TABLE).update({
        state, error_code: errorCode, provider_id: providerId, updated_at: now.toISOString(),
        ...(state === "sent" ? { sent_at: now.toISOString() } : {}),
      }).eq("id", event.id).eq("state", "sending").eq("claimed_at", event.claimed_at)
        .select("id").abortSignal(timeout()).maybeSingle();
      if (updateError || !updated) throw new Error("email_finalization_unavailable");
      totals[state]++;
      // The outbox is the source of truth; this audit is only a human-readable trace.
      try {
        await db.from("activities").insert({ lead_id: event.lead_id, actor_id: null,
          kind: "project_status_email", detail: JSON.stringify({ event_id: event.id, etat: state,
            statut: travelerProjectTracking(event.status)?.libelle,
            ...(providerId ? { provider_id: providerId } : {}), ...(errorCode ? { motif: errorCode } : {}) })
        }).abortSignal(AbortSignal.timeout(1000));
      } catch { /* Delivery state is already durable. */ }
    };
    try {
      const { data: lead, error: leadError } = await db.from("leads")
        .select("id,email,traveler_name,status,intake_payload,deleted_at").eq("id", event.lead_id)
        .abortSignal(timeout()).maybeSingle();
      if (leadError) { await finish("failed", "lead_read_unavailable"); continue; }
      if (!lead || lead.deleted_at || receiptRecipient(lead.email) !== event.recipient) {
        await finish("skipped", "recipient_or_lead_changed"); continue;
      }
      if (!lead.intake_payload || typeof lead.intake_payload !== "object" || Array.isArray(lead.intake_payload)) {
        await finish("skipped", "request_not_eligible"); continue;
      }
      const draft = buildProjectStatusEmail({ eventId: event.id, leadId: event.lead_id,
        fullName: String(lead.traveler_name ?? ""), email: event.recipient,
        intake: lead.intake_payload, previousStatus: event.previous_status, status: event.status });
      if (!draft) { await finish("skipped", "request_not_eligible"); continue; }
      // If several changes occurred before dispatch, do not announce an obsolete step.
      if (!event.mail_payload && travelerProjectTracking(lead.status)?.code !== travelerProjectTracking(event.status)?.code) {
        await finish("skipped", "status_superseded"); continue;
      }
      let mail = event.mail_payload;
      if (!mail) {
        const { data: saved, error: saveError } = await db.from(TABLE).update({ mail_payload: draft })
          .eq("id", event.id).eq("state", "sending").eq("claimed_at", event.claimed_at)
          .is("mail_payload", null).select("mail_payload").abortSignal(timeout()).maybeSingle();
        if (saveError || !saved) { await finish("failed", "email_snapshot_unavailable"); continue; }
        mail = saved.mail_payload as Mail;
      }
      if (mail.to !== event.recipient || mail.idempotencyKey !== `project-status-${event.id}`) {
        await finish("unknown", "email_snapshot_mismatch"); continue;
      }
      // Do not spread DB data into the provider request: project only the allowed fields.
      const result = await sendTransactionalHtmlEmail({ to: mail.to, subject: mail.subject,
        html: mail.html, text: mail.text, idempotencyKey: mail.idempotencyKey, timeoutMs: 5000 });
      if (result.ok && result.providerId) await finish("sent", null, result.providerId);
      else if (result.ok || result.deliveryUnknown) await finish("unknown", "provider_confirmation_unknown");
      else await finish("failed", "provider_rejected");
    } catch {
      // A network interruption can occur after Resend accepted the message. Keep
      // the claim locked; the SQL maintenance converts abandoned claims to unknown.
      totals.unknown++;
      console.error("[project-status-emails] dispatch requires reconciliation", event.id);
    }
  }
  return totals;
}
