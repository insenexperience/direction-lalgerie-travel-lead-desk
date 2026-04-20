"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import { sendTransactionalHtmlEmail } from "@/lib/email/resend-client";
import {
  isResendOutboundConfigured,
  isAiWelcomeEmailCtAsConfigured,
} from "@/lib/email/workflow-email-config";
import {
  buildWorkflowReplyMailto,
  buildWorkflowWelcomeEmailAiHtml,
  buildWorkflowWelcomeEmailSimpleHtml,
  normalizeWhatsAppE164,
} from "@/lib/email/workflow-welcome";

export type WorkflowLaunchResult =
  | { ok: true; travelerEmailSent: boolean }
  | { ok: false; error: string };

export type WorkflowSessionResetResult = { ok: true } | { ok: false; error: string };

type LeadWorkflowRow = {
  id: string;
  referent_id: string | null;
  status: string;
  workflow_launched_at: string | null;
  workflow_mode: string | null;
  manual_takeover: boolean;
  email: string;
  traveler_name: string;
  trip_summary: string;
  travel_style: string;
  travelers: string;
  budget: string;
  trip_dates: string;
  submission_id: string | null;
};

async function logWorkflowActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  actorId: string,
  kind: string,
  detail: string,
) {
  await supabase.from("activities").insert({
    lead_id: leadId,
    actor_id: actorId,
    kind,
    detail,
  });
}

function newWorkflowRunRef(): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `WF-${id.slice(0, 12).toUpperCase()}`;
}

async function fetchLeadForWorkflow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
): Promise<{ ok: true; row: LeadWorkflowRow } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, referent_id, status, workflow_launched_at, workflow_mode, manual_takeover, email, traveler_name, trip_summary, travel_style, travelers, budget, trip_dates, submission_id",
    )
    .eq("id", leadId)
    .maybeSingle();

  if (error) {
    if (
    error.message?.includes("workflow_launched_at") ||
    error.message?.includes("submission_id") ||
    error.message?.includes("workflow_run_ref") ||
    error.message?.includes("manual_takeover")
  ) {
      return {
        ok: false,
        error:
          "Migrations Supabase à jour requises (colonnes workflow / submission_id). Exécutez `npm run db:push`.",
      };
    }
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "Lead introuvable." };
  }

  return {
    ok: true,
    row: {
      id: String(data.id),
      referent_id: data.referent_id ? String(data.referent_id) : null,
      status: String(data.status ?? "new"),
      workflow_launched_at: data.workflow_launched_at
        ? String(data.workflow_launched_at)
        : null,
      workflow_mode: data.workflow_mode != null ? String(data.workflow_mode) : null,
      manual_takeover: Boolean(data.manual_takeover),
      email: String(data.email ?? "").trim(),
      traveler_name: String(data.traveler_name ?? ""),
      trip_summary: String(data.trip_summary ?? ""),
      travel_style: String(data.travel_style ?? ""),
      travelers: String(data.travelers ?? ""),
      budget: String(data.budget ?? ""),
      trip_dates: String(data.trip_dates ?? ""),
      submission_id:
        data.submission_id != null && String(data.submission_id).trim() !== ""
          ? String(data.submission_id).trim()
          : null,
    },
  };
}

function assertCanLaunchWorkflow(
  row: LeadWorkflowRow,
  userId: string,
  kind: "ai" | "manual",
): WorkflowLaunchResult | null {
  if (row.referent_id !== userId) {
    return {
      ok: false,
      error: "Seul le référent assigné à ce dossier peut lancer le workflow.",
    };
  }
  if (row.status !== "new" && row.status !== "qualification") {
    return {
      ok: false,
      error:
        "Le workflow voyageur ne peut être lancé qu’aux étapes « Nouveau » ou « Qualification & affinage ».",
    };
  }
  if (!row.email) {
    return { ok: false, error: "Aucune adresse email voyageur sur la fiche." };
  }

  const sessionActive = Boolean(row.workflow_launched_at && row.workflow_mode);

  if (kind === "ai") {
    if (sessionActive) {
      return {
        ok: false,
        error:
          "Une session workflow est déjà active sur ce dossier (supprimez-la depuis la fiche ou la page manuelle pour en lancer une autre en mode IA).",
      };
    }
    return null;
  }

  if (sessionActive && row.workflow_mode === "manual") {
    return {
      ok: false,
      error:
        "Une session manuelle est déjà enregistrée. Supprimez la session workflow ci-dessous pour en lancer une autre.",
    };
  }
  if (sessionActive && row.workflow_mode === "ai" && !row.manual_takeover) {
    return {
      ok: false,
      error:
        "L’IA est active sur ce dossier : suspendez-la depuis la fiche (bandeau cockpit), ou supprimez la session workflow.",
    };
  }

  return null;
}

const WORKFLOW_SUBJECT = "Direction l'Algérie — confirmation de votre projet";

export async function launchWorkflowAi(leadId: string): Promise<WorkflowLaunchResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Identifiant de lead invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const fetched = await fetchLeadForWorkflow(supabase, leadId);
  if (!fetched.ok) return { ok: false, error: fetched.error };

  const block = assertCanLaunchWorkflow(fetched.row, user.id, "ai");
  if (block) return block;

  let travelerEmailSent = false;
  let activityDetail = "";

  if (isResendOutboundConfigured()) {
    let html: string;
    if (isAiWelcomeEmailCtAsConfigured()) {
      const waRaw = process.env.NEXT_PUBLIC_WHATSAPP_DA_NUMBER?.trim() ?? "";
      const waDigits = normalizeWhatsAppE164(waRaw);
      const contact =
        process.env.NEXT_PUBLIC_DA_CONTACT_EMAIL?.trim() ||
        process.env.RESEND_FROM_EMAIL?.trim() ||
        "";
      if (!waDigits || !contact.includes("@")) {
        return {
          ok: false,
          error: "Configuration email incohérente (CTA). Rechargez la page ou vérifiez les variables d’environnement.",
        };
      }
      const ref = fetched.row.submission_id ?? fetched.row.id;
      const waText = `Bonjour, je souhaite co-construire mon voyage ref:${ref}`;
      const whatsappHref = `https://wa.me/${waDigits}?text=${encodeURIComponent(waText)}`;
      const mailtoHref = buildWorkflowReplyMailto(ref, contact);
      html = buildWorkflowWelcomeEmailAiHtml(fetched.row, { whatsappHref, mailtoHref });
      activityDetail =
        "Workflow lancé (mode IA) — email de bienvenue avec CTA WhatsApp et email envoyé au voyageur.";
    } else {
      html = buildWorkflowWelcomeEmailSimpleHtml(fetched.row);
      activityDetail =
        "Workflow lancé (mode IA) — email simplifié envoyé (CTA WhatsApp / mailto incomplets côté configuration).";
    }

    const sent = await sendTransactionalHtmlEmail({
      to: fetched.row.email,
      subject: WORKFLOW_SUBJECT,
      html,
    });
    if (!sent.ok) {
      return { ok: false, error: sent.error };
    }
    travelerEmailSent = true;
  } else {
    activityDetail =
      "Workflow lancé (mode IA) — aucun email envoyé (Resend non configuré : RESEND_API_KEY / RESEND_FROM_EMAIL).";
  }

  const now = new Date().toISOString();
  const runRef = newWorkflowRunRef();
  const patch: Record<string, unknown> = {
    workflow_launched_at: now,
    workflow_launched_by: user.id,
    workflow_mode: "ai",
    workflow_run_ref: runRef,
    manual_takeover: false,
  };
  if (fetched.row.status === "new") {
    patch.status = "qualification";
  }

  const { error: upErr } = await supabase.from("leads").update(patch).eq("id", leadId);

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  await logWorkflowActivity(
    supabase,
    leadId,
    user.id,
    "workflow_launch_ai",
    `${activityDetail} Réf. session : ${runRef}.`,
  );

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/leads/${leadId}/workflow`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { ok: true, travelerEmailSent };
}

export async function launchWorkflowManual(
  leadId: string,
  sendWelcomeEmail: boolean,
): Promise<WorkflowLaunchResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Identifiant de lead invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const fetched = await fetchLeadForWorkflow(supabase, leadId);
  if (!fetched.ok) return { ok: false, error: fetched.error };

  const block = assertCanLaunchWorkflow(fetched.row, user.id, "manual");
  if (block) return block;

  let travelerEmailSent = false;
  let activityDetail: string;

  if (sendWelcomeEmail) {
    if (isResendOutboundConfigured()) {
      const html = buildWorkflowWelcomeEmailSimpleHtml(fetched.row);
      const sent = await sendTransactionalHtmlEmail({
        to: fetched.row.email,
        subject: WORKFLOW_SUBJECT,
        html,
      });
      if (!sent.ok) {
        return { ok: false, error: sent.error };
      }
      travelerEmailSent = true;
      activityDetail =
        "Workflow lancé (mode manuel) — email de bienvenue simple envoyé au voyageur.";
    } else {
      activityDetail =
        "Workflow lancé (mode manuel) — email de bienvenue non envoyé (Resend non configuré alors que la case était cochée).";
    }
  } else {
    activityDetail = "Workflow lancé (mode manuel) — sans email de bienvenue.";
  }

  const now = new Date().toISOString();
  const runRef = newWorkflowRunRef();
  const patch: Record<string, unknown> = {
    workflow_launched_at: now,
    workflow_launched_by: user.id,
    workflow_mode: "manual",
    workflow_run_ref: runRef,
    manual_takeover: false,
  };
  if (fetched.row.status === "new") {
    patch.status = "qualification";
  }

  const { error: upErr } = await supabase.from("leads").update(patch).eq("id", leadId);

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  await logWorkflowActivity(
    supabase,
    leadId,
    user.id,
    "workflow_launch_manual",
    `${activityDetail} Réf. session : ${runRef}.`,
  );

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/leads/${leadId}/workflow`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { ok: true, travelerEmailSent };
}

/**
 * Supprime la session workflow voyageur en cours (références, mode, transcript IA associé,
 * validation qualification). Ne change pas le statut pipeline du lead.
 */
export async function resetWorkflowVoyageurSession(
  leadId: string,
): Promise<WorkflowSessionResetResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Identifiant de lead invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const { data: row, error } = await supabase
    .from("leads")
    .select("referent_id, workflow_launched_at, workflow_mode, workflow_run_ref")
    .eq("id", leadId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: "Lead introuvable." };
  }

  if (row.referent_id !== user.id) {
    return {
      ok: false,
      error: "Seul le référent assigné peut supprimer la session workflow sur ce dossier.",
    };
  }

  if (!row.workflow_launched_at) {
    return { ok: false, error: "Aucune session workflow active à supprimer." };
  }

  const refNote =
    row.workflow_run_ref != null ? String(row.workflow_run_ref) : "(sans référence)";

  const { error: upErr } = await supabase
    .from("leads")
    .update({
      workflow_launched_at: null,
      workflow_launched_by: null,
      workflow_mode: null,
      workflow_run_ref: null,
      manual_takeover: false,
      conversation_transcript: [],
      ai_qualification_payload: null,
      ai_qualification_confidence: null,
      qualification_validation_status: "pending",
      qualification_validated_at: null,
      qualification_validated_by: null,
    })
    .eq("id", leadId);

  if (upErr) {
    if (upErr.message?.includes("workflow_run_ref")) {
      return {
        ok: false,
        error:
          "Colonne workflow_run_ref absente : exécutez les migrations Supabase (`npm run db:push`).",
      };
    }
    return { ok: false, error: upErr.message };
  }

  await logWorkflowActivity(
    supabase,
    leadId,
    user.id,
    "workflow_session_reset",
    `Session workflow supprimée (réf. ${refNote}). Transcript / brouillon qualification réinitialisés.`,
  );

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/leads/${leadId}/workflow`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { ok: true };
}
