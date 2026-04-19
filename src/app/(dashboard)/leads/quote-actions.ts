"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import type { QuoteWorkflowStatus } from "@/lib/quote-workflow";
import {
  canChangeQuoteWorkflow,
  coerceQuoteWorkflowStatus,
  quoteWorkflowToLeadQuoteStatusFr,
} from "@/lib/quote-workflow";

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
