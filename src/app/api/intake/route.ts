import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  buildIntakeRecordFromBody,
  buildLeadInsertFromIntake,
  corsHeaders,
  intakeStr,
  resolveCors,
  resolveFullNameFromIntakeBody,
  verifyIntakeSharedSecret,
} from "@/lib/intake-lead-insert";
import { notifierNouveauLead } from "@/lib/email/lead-notification";
import { envoyerAccuseDemande } from "@/lib/email/demande-receipt";
import { accuseReceptionActif, envoyerAccuseReception } from "@/lib/email/traveler-ack";
import type { EmailSendResult } from "@/lib/email/resend-client";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { hashTrackingToken, verifyTrackingToken } from "@/lib/traveler-project-tracking";

export const runtime = "nodejs";

type IntakeJson = Record<string, unknown>;

function mailActivity(leadId: string, kind: string, result: EmailSendResult) {
  const providerId = result.ok && typeof result.providerId === "string" && /^[a-zA-Z0-9._:-]{1,200}$/.test(result.providerId) ? result.providerId : null;
  return {
    lead_id: leadId, actor_id: null, kind,
    detail: JSON.stringify(result.ok
      ? { etat: "transmis_au_prestataire", ...(providerId ? { provider_id: providerId } : {}) }
      : { etat: result.deliveryUnknown ? "confirmation_inconnue" : "echec", motif: /n'est pas configuré/.test(result.error) ? "configuration_email_absente" : "transmission_non_confirmee" }),
  };
}

export function OPTIONS(request: Request) {
  const { allowOrigin } = resolveCors(request);
  return new NextResponse(null, { status: 204, headers: corsHeaders(allowOrigin) });
}

export async function POST(request: Request) {
  const { allowOrigin, forbidden } = resolveCors(request);
  const jsonHeaders = { ...corsHeaders(allowOrigin), "Content-Type": "application/json", "Cache-Control": "no-store, private" };

  if (forbidden) {
    return NextResponse.json(
      { error: "Forbidden origin" },
      { status: 403, headers: jsonHeaders },
    );
  }

  if (!verifyIntakeSharedSecret(request)) {
    console.error("[api/intake] 401 — INTAKE_SHARED_SECRET est défini mais en-tête Authorization / X-Intake-Secret absent ou incorrect");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: jsonHeaders });
  }

  let body: IntakeJson;
  try {
    body = (await request.json()) as IntakeJson;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
  } catch {
    console.error("[api/intake] invalid JSON");
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const trackingHash = hashTrackingToken(body.suivi_token);
  if (body.suivi_token !== undefined && !trackingHash) {
    return NextResponse.json({ error: "Invalid receipt proof" }, { status: 422, headers: jsonHeaders });
  }

  const fullName = resolveFullNameFromIntakeBody(body);
  const email = intakeStr(body.email);

  if (!fullName || !email) {
    return NextResponse.json(
      {
        error: "Missing required fields",
        hint: "Envoyer email et nom (full_name ou first + last).",
      },
      { status: 422, headers: jsonHeaders },
    );
  }

  let supabase: ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    console.error("[api/intake] Supabase service client", e);
    return NextResponse.json({ error: "DB error" }, { status: 500, headers: jsonHeaders });
  }

  const clientSubmissionId = intakeStr(body.submission_id);
  const submissionId = clientSubmissionId || randomUUID();
  const bodyForIntake: IntakeJson = { ...body, submission_id: submissionId };
  // The raw browser capability must never be stored or passed to notifications.
  delete bodyForIntake.suivi_token;
  delete bodyForIntake.suivi_token_hash;

  const receivedResponse = (existing: { id: unknown; intake_payload: unknown; deleted_at: unknown }) => NextResponse.json(
    {
      status: "already_received", id: String(existing.id),
      ...(!existing.deleted_at && verifyTrackingToken(body.suivi_token, existing.intake_payload) ? { suivi_disponible: true } : {}),
    },
    { status: 200, headers: jsonHeaders },
  );

  try {
    if (clientSubmissionId) {
      const { data: existing, error: findErr } = await supabase
        .from("leads")
        .select("id,intake_payload,deleted_at")
        .eq("submission_id", clientSubmissionId)
        .maybeSingle();

      if (findErr) {
        console.error("[api/intake] idempotency select", findErr);
        return NextResponse.json({ error: "DB error" }, { status: 500, headers: jsonHeaders });
      }

      if (existing?.id) {
        return receivedResponse(existing);
      }
    }

    const intake = buildIntakeRecordFromBody(bodyForIntake);
    const row = buildLeadInsertFromIntake(intake);
    // Hash lives in existing JSONB storage; legacy records are never granted access retroactively.
    if (trackingHash) row.intake_payload = { ...row.intake_payload, suivi_token_hash: trackingHash };

    const { data: created, error: insErr } = await supabase
      .from("leads")
      .insert(row)
      .select("id")
      .single();

    if (insErr || !created?.id) {
      // A concurrent retry can lose the unique submission_id race after the first lookup.
      if (insErr?.code === "23505" && clientSubmissionId) {
        const { data: existing, error: retryError } = await supabase.from("leads")
          .select("id,intake_payload,deleted_at").eq("submission_id", clientSubmissionId).maybeSingle();
        if (!retryError && existing?.id) return receivedResponse(existing);
      }
      console.error("[api/intake] insert", insErr?.code ?? "unknown");
      return NextResponse.json({ error: "DB error" }, { status: 500, headers: jsonHeaders });
    }

    console.info("[api/intake] created lead", String(created.id), "submission_id", submissionId);

    // Le lead est enregistré : l'alerte ne doit plus pouvoir faire échouer la
    // requête. Elle est attendue malgré tout — une promesse laissée en
    // suspens serait interrompue à la fin de la fonction serverless, et
    // personne ne serait prévenu.
    const leadId = String(created.id);
    const unknownDelivery = (): EmailSendResult => ({ ok: false, deliveryUnknown: true, error: "Confirmation d’envoi indisponible." });
    // The legacy form keeps its opt-in acknowledgement; new requests use only
    // their consent-aware receipt, even if that receipt is ineligible.
    const isProjectRequest = !!body.trame && typeof body.trame === "object" && (body.trame as Record<string, unknown>).type === "demande-projet-voyage";
    const [alerte, accuse, legacyAck] = await Promise.all([
      notifierNouveauLead({ leadId, intake }).catch(unknownDelivery),
      envoyerAccuseDemande({ leadId, intake }).catch(unknownDelivery),
      !isProjectRequest && accuseReceptionActif() && email
        ? envoyerAccuseReception({ email, nom: fullName }).catch(() => ({ ok: false, texte: "" }))
        : Promise.resolve(null),
    ]);
    // Provider acceptance is distinct from inbox delivery. Audit is best effort and never changes the pipeline.
    const activities = [mailActivity(leadId, "intake_team_email", alerte),
      ...(accuse ? [mailActivity(leadId, "intake_receipt_email", accuse)] : []),
      ...(legacyAck?.ok ? [{ lead_id: leadId, actor_id: null, kind: "ack_sent",
        detail: "Accusé de réception envoyé", payload: { k: "auto", s: "Accusé de réception envoyé", b: legacyAck.texte } }] : [])];
    try {
      const { error: auditError } = await supabase.from("activities").insert(activities).abortSignal(AbortSignal.timeout(1000));
      if (auditError) console.error("[api/intake] email audit unavailable");
    } catch { console.error("[api/intake] email audit unavailable"); }

    revalidatePath("/inbox");
    revalidatePath("/leads");
    revalidatePath("/dashboard");
    revalidatePath("/metrics");

    return NextResponse.json(
      { status: "created", id: String(created.id), notified: alerte.ok,
        ...(accuse ? { receipt_sent: accuse.ok } : {}), ...(trackingHash ? { suivi_disponible: true } : {}) },
      { status: 201, headers: jsonHeaders },
    );
  } catch {
    console.error("[api/intake] unexpected database error");
    return NextResponse.json({ error: "DB error" }, { status: 500, headers: jsonHeaders });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
