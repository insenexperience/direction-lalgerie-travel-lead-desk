"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import type { ActionResult } from "@/app/(dashboard)/leads/actions";
import { sendTransactionalHtmlEmail } from "@/lib/email/resend-client";
import {
  buildWorkflowReplyMailto,
  buildWorkflowWelcomeEmailAiHtml,
  buildWorkflowWelcomeEmailSimpleHtml,
  normalizeWhatsAppE164,
} from "@/lib/email/workflow-welcome";

type LeadWorkflowRow = {
  id: string;
  referent_id: string | null;
  status: string;
  workflow_launched_at: string | null;
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
  kind: "workflow_launch_ai" | "workflow_launch_manual",
  detail: string,
) {
  await supabase.from("activities").insert({
    lead_id: leadId,
    actor_id: actorId,
    kind,
    detail,
  });
}

async function fetchLeadForWorkflow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
): Promise<{ ok: true; row: LeadWorkflowRow } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, referent_id, status, workflow_launched_at, email, traveler_name, trip_summary, travel_style, travelers, budget, trip_dates, submission_id",
    )
    .eq("id", leadId)
    .maybeSingle();

  if (error) {
    if (error.message?.includes("workflow_launched_at") || error.message?.includes("submission_id")) {
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

function assertCanLaunch(
  row: LeadWorkflowRow,
  userId: string,
): ActionResult | null {
  if (row.referent_id !== userId) {
    return {
      ok: false,
      error: "Seul le référent assigné à ce dossier peut lancer le workflow.",
    };
  }
  if (row.status !== "new") {
    return {
      ok: false,
      error: "Le workflow ne peut être lancé que pour un lead au statut « Nouveau ».",
    };
  }
  if (row.workflow_launched_at) {
    return { ok: false, error: "Le workflow a déjà été lancé pour ce dossier." };
  }
  if (!row.email) {
    return { ok: false, error: "Aucune adresse email voyageur sur la fiche." };
  }
  return null;
}

const WORKFLOW_SUBJECT = "Direction l'Algérie — confirmation de votre projet";

export async function launchWorkflowAi(leadId: string): Promise<ActionResult> {
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

  const block = assertCanLaunch(fetched.row, user.id);
  if (block) return block;

  const waRaw = process.env.NEXT_PUBLIC_WHATSAPP_DA_NUMBER?.trim() ?? "";
  const waDigits = normalizeWhatsAppE164(waRaw);
  if (!waDigits) {
    return {
      ok: false,
      error:
        "NEXT_PUBLIC_WHATSAPP_DA_NUMBER doit être défini (numéro WhatsApp DA, chiffres avec indicatif pays).",
    };
  }

  const contact =
    process.env.NEXT_PUBLIC_DA_CONTACT_EMAIL?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim();
  if (!contact || !contact.includes("@")) {
    return {
      ok: false,
      error:
        "NEXT_PUBLIC_DA_CONTACT_EMAIL (ou RESEND_FROM_EMAIL) doit être une adresse email valide pour le lien « Poursuivre par email ».",
    };
  }

  const ref = fetched.row.submission_id ?? fetched.row.id;
  const waText = `Bonjour, je souhaite co-construire mon voyage ref:${ref}`;
  const whatsappHref = `https://wa.me/${waDigits}?text=${encodeURIComponent(waText)}`;
  const mailtoHref = buildWorkflowReplyMailto(ref, contact);

  const html = buildWorkflowWelcomeEmailAiHtml(fetched.row, { whatsappHref, mailtoHref });
  const sent = await sendTransactionalHtmlEmail({
    to: fetched.row.email,
    subject: WORKFLOW_SUBJECT,
    html,
  });
  if (!sent.ok) {
    return sent;
  }

  const now = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("leads")
    .update({
      status: "qualification",
      workflow_launched_at: now,
      workflow_launched_by: user.id,
      workflow_mode: "ai",
    })
    .eq("id", leadId);

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  await logWorkflowActivity(
    supabase,
    leadId,
    user.id,
    "workflow_launch_ai",
    "Workflow lancé (mode IA) — email de bienvenue avec CTA WhatsApp et email envoyé au voyageur.",
  );

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/leads/${leadId}/workflow`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function launchWorkflowManual(
  leadId: string,
  sendWelcomeEmail: boolean,
): Promise<ActionResult> {
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

  const block = assertCanLaunch(fetched.row, user.id);
  if (block) return block;

  if (sendWelcomeEmail) {
    const html = buildWorkflowWelcomeEmailSimpleHtml(fetched.row);
    const sent = await sendTransactionalHtmlEmail({
      to: fetched.row.email,
      subject: WORKFLOW_SUBJECT,
      html,
    });
    if (!sent.ok) {
      return sent;
    }
  }

  const now = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("leads")
    .update({
      status: "qualification",
      workflow_launched_at: now,
      workflow_launched_by: user.id,
      workflow_mode: "manual",
    })
    .eq("id", leadId);

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  const detail = sendWelcomeEmail
    ? "Workflow lancé (mode manuel) — email de bienvenue simple envoyé au voyageur."
    : "Workflow lancé (mode manuel) — sans email de bienvenue.";

  await logWorkflowActivity(supabase, leadId, user.id, "workflow_launch_manual", detail);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/leads/${leadId}/workflow`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { ok: true };
}
