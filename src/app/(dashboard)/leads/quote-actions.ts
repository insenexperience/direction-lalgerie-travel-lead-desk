"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import { buildQuoteDevisPdfBuffer } from "@/lib/pdf/build-quote-devis-buffer";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { QuoteWorkflowStatus } from "@/lib/quote-workflow";
import {
  canChangeQuoteWorkflow,
  coerceQuoteWorkflowStatus,
  isTerminalQuoteWorkflow,
  quoteWorkflowToLeadQuoteStatusFr,
} from "@/lib/quote-workflow";
import { sendWhatsAppDocumentMessage } from "@/lib/whatsapp/client";

export type QuoteActionResult = { ok: true } | { ok: false; error: string };

export async function updateQuoteWorkflowStatus(
  leadId: string,
  quoteId: string,
  nextStatus: QuoteWorkflowStatus,
): Promise<QuoteActionResult> {
  if (!isUuid(leadId) || !isUuid(quoteId)) {
    return { ok: false, error: "Identifiants invalides." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const { data: row, error: fetchErr } = await supabase
    .from("quotes")
    .select("id, lead_id, workflow_status")
    .eq("id", quoteId)
    .maybeSingle();

  if (fetchErr || !row) {
    return { ok: false, error: "Devis introuvable." };
  }
  if (String(row.lead_id) !== leadId) {
    return { ok: false, error: "Ce devis n’appartient pas à ce dossier." };
  }

  const current = coerceQuoteWorkflowStatus(row.workflow_status);
  if (!canChangeQuoteWorkflow(current, nextStatus)) {
    return {
      ok: false,
      error:
        "Ce devis est déjà clos (gagné, perdu ou suspendu) : le statut ne peut plus être modifié.",
    };
  }

  const { error: upQ } = await supabase
    .from("quotes")
    .update({
      workflow_status: nextStatus,
      status: nextStatus,
    })
    .eq("id", quoteId);

  if (upQ) {
    return { ok: false, error: upQ.message };
  }

  const leadPatch: Record<string, string> = {
    quote_status: quoteWorkflowToLeadQuoteStatusFr(nextStatus),
  };

  if (nextStatus === "won") {
    leadPatch.status = "won";
  } else if (nextStatus === "lost") {
    leadPatch.status = "lost";
  }

  const { error: upL } = await supabase.from("leads").update(leadPatch).eq("id", leadId);

  if (upL) {
    return { ok: false, error: upL.message };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/metrics");
  return { ok: true };
}

export async function sendQuoteDevisViaWhatsApp(
  leadId: string,
  quoteId: string,
): Promise<QuoteActionResult> {
  if (!isUuid(leadId) || !isUuid(quoteId)) {
    return { ok: false, error: "Identifiants invalides." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const { data: leadRow, error: leadErr } = await supabase
    .from("leads")
    .select("id, traveler_name, email, phone, whatsapp_phone_number, trip_summary")
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr || !leadRow) {
    return { ok: false, error: "Lead introuvable." };
  }

  const waRaw =
    (leadRow.whatsapp_phone_number &&
      String(leadRow.whatsapp_phone_number).trim()) ||
    String(leadRow.phone ?? "").trim();
  if (!waRaw) {
    return {
      ok: false,
      error: "Aucun numéro WhatsApp ou téléphone sur la fiche voyageur.",
    };
  }

  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .select("id, lead_id, items, workflow_status, created_at")
    .eq("id", quoteId)
    .maybeSingle();

  if (qErr || !quote) {
    return { ok: false, error: "Devis introuvable." };
  }
  if (String(quote.lead_id) !== leadId) {
    return { ok: false, error: "Ce devis n’appartient pas à ce dossier." };
  }

  const wf = coerceQuoteWorkflowStatus(quote.workflow_status);
  if (isTerminalQuoteWorkflow(wf)) {
    return {
      ok: false,
      error: "Ce devis est clos : envoi impossible.",
    };
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    return {
      ok: false,
      error:
        "Envoi stockage indisponible : définir SUPABASE_SERVICE_ROLE_KEY côté serveur.",
    };
  }

  const buffer = await buildQuoteDevisPdfBuffer({
    quote: {
      id: String(quote.id),
      items: quote.items,
      workflow_status: quote.workflow_status,
      created_at: quote.created_at,
    },
    lead: {
      traveler_name: String(leadRow.traveler_name ?? ""),
      email: String(leadRow.email ?? ""),
      phone: String(leadRow.phone ?? ""),
      trip_summary: String(leadRow.trip_summary ?? ""),
    },
  });

  const storagePath = `${leadId}/${quoteId}.pdf`;
  const { error: upErr } = await admin.storage
    .from("quote_pdfs")
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (upErr) {
    return {
      ok: false,
      error: `Stockage : ${upErr.message} (bucket quote_pdfs — voir migrations).`,
    };
  }

  const { data: signed, error: signErr } = await admin.storage
    .from("quote_pdfs")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  if (signErr || !signed?.signedUrl) {
    return {
      ok: false,
      error: signErr?.message ?? "Impossible de générer le lien signé.",
    };
  }

  const safeName = `devis-${quoteId.slice(0, 8)}.pdf`;
  const sent = await sendWhatsAppDocumentMessage(
    waRaw,
    signed.signedUrl,
    safeName,
    "Votre devis Direction l'Algérie (PDF).",
  );

  if (!sent.ok) {
    return { ok: false, error: sent.error };
  }

  const nowIso = new Date().toISOString();
  const nextWf: QuoteWorkflowStatus = wf === "draft" ? "sent" : wf;

  const quotePatch: Record<string, unknown> = {
    sent_at: nowIso,
    sent_via: "whatsapp",
    pdf_storage_path: storagePath,
  };
  if (nextWf !== wf) {
    quotePatch.workflow_status = nextWf;
    quotePatch.status = nextWf;
  }

  const { error: upQ } = await supabase
    .from("quotes")
    .update(quotePatch)
    .eq("id", quoteId);

  if (upQ) {
    return { ok: false, error: upQ.message };
  }

  if (nextWf !== wf) {
    const { error: upL } = await supabase
      .from("leads")
      .update({ quote_status: quoteWorkflowToLeadQuoteStatusFr(nextWf) })
      .eq("id", leadId);
    if (upL) {
      return { ok: false, error: upL.message };
    }
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/metrics");
  return { ok: true };
}
