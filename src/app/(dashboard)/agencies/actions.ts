"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/is-uuid";
import type { CreatePartnerAgencyInput } from "@/lib/mock-agencies";
import type { AgencyUpdateInput } from "@/lib/agencies/types";
import type { PartnerAgencyStatus } from "@/lib/mock-agencies";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createPartnerAgency(
  input: CreatePartnerAgencyInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const legalName = input.legalName.trim();
  if (!legalName) {
    return { ok: false, error: "La raison sociale est obligatoire." };
  }
  const city = input.city.trim();
  const contactName = input.contactName.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();
  if (!city || !contactName || !email || !phone) {
    return {
      ok: false,
      error: "Ville, contact, email et téléphone sont obligatoires.",
    };
  }

  const sla = Math.max(1, Math.min(30, input.slaQuoteDays));

  const { error } = await supabase.from("agencies").insert({
    legal_name: legalName,
    trade_name: input.tradeName?.trim() || null,
    type: input.type,
    country: input.country.trim() || "",
    city,
    website: input.website?.trim() || null,
    contact_name: contactName,
    email,
    phone,
    destinations: input.destinations.trim(),
    languages: input.languages.trim(),
    segments: input.segments.trim(),
    sla_quote_days: sla,
    status: input.status,
    internal_notes: input.internalNotes?.trim() || null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/agencies");
  revalidatePath("/leads");
  return { ok: true };
}

export async function deletePartnerAgency(agencyId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  if (!isUuid(agencyId)) {
    return { ok: false, error: "Identifiant d’agence invalide." };
  }

  const { error } = await supabase.from("agencies").delete().eq("id", agencyId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/agencies");
  revalidatePath("/leads");
  revalidatePath("/metrics");
  return { ok: true };
}

export async function updateAgency(id: string, input: AgencyUpdateInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };
  if (!isUuid(id)) return { ok: false, error: "Identifiant invalide." };

  const legalName = input.legal_name?.trim();
  if (legalName !== undefined && !legalName) {
    return { ok: false, error: "La raison sociale ne peut pas être vide." };
  }

  const updateData: Record<string, unknown> = {};
  if (input.legal_name !== undefined) updateData.legal_name = input.legal_name.trim();
  if (input.trade_name !== undefined) updateData.trade_name = input.trade_name?.trim() || null;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.country !== undefined) updateData.country = input.country.trim();
  if (input.city !== undefined) updateData.city = input.city.trim();
  if (input.website !== undefined) updateData.website = input.website?.trim() || null;
  if (input.destinations !== undefined) updateData.destinations = input.destinations.trim();
  if (input.languages !== undefined) updateData.languages = input.languages.trim();
  if (input.segments !== undefined) updateData.segments = input.segments.trim();
  if (input.sla_quote_days !== undefined) updateData.sla_quote_days = Math.max(1, Math.min(30, input.sla_quote_days));
  if (input.internal_notes !== undefined) updateData.internal_notes = input.internal_notes?.trim() || null;
  if (input.ai_capabilities_summary !== undefined) updateData.ai_capabilities_summary = input.ai_capabilities_summary?.trim() || null;

  const { error } = await supabase.from("agencies").update(updateData).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/agencies");
  revalidatePath(`/agencies/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateAgencyStatus(id: string, status: PartnerAgencyStatus): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };
  if (!isUuid(id)) return { ok: false, error: "Identifiant invalide." };

  const { error } = await supabase.from("agencies").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/agencies");
  revalidatePath(`/agencies/${id}`);
  return { ok: true };
}

export type DeleteAgencyResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; blocked: true; activeLeads: number; activeConsultations: number };

export async function deleteAgency(
  agencyId: string,
  options?: { force?: boolean }
): Promise<DeleteAgencyResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };
  if (!isUuid(agencyId)) return { ok: false, error: "Identifiant invalide." };

  // Check for active links
  const [retainedRes, consultationsRes] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("retained_agency_id", agencyId)
      .not("status", "in", '("won","lost")'),
    supabase
      .from("consultations")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .not("status", "in", '("declined","quote_received")'),
  ]);

  const activeLeads = retainedRes.count ?? 0;
  const activeConsultations = consultationsRes.count ?? 0;

  if (!options?.force && (activeLeads > 0 || activeConsultations > 0)) {
    return { ok: false, blocked: true, activeLeads, activeConsultations };
  }

  if (options?.force && (activeLeads > 0 || activeConsultations > 0)) {
    // Service role to bypass RLS for cross-table operations
    const admin = createServiceRoleClient();

    // Detach retained leads
    if (activeLeads > 0) {
      const { data: impactedLeads } = await admin
        .from("leads")
        .select("id")
        .eq("retained_agency_id", agencyId)
        .not("status", "in", '("won","lost")');

      await admin.from("leads").update({ retained_agency_id: null }).eq("retained_agency_id", agencyId).not("status", "in", '("won","lost")');

      // Log activity on each impacted lead
      if (impactedLeads?.length) {
        const activities = impactedLeads.map((l) => ({
          lead_id: l.id,
          actor_id: user.id,
          kind: "agency_removed",
          detail: `Agence supprimée (id: ${agencyId}).`,
        }));
        await admin.from("activities").insert(activities);
      }
    }

    // Archive active consultations
    if (activeConsultations > 0) {
      await admin
        .from("consultations")
        .update({ status: "declined" })
        .eq("agency_id", agencyId)
        .not("status", "in", '("declined","quote_received")');
    }
  }

  const { error } = await supabase.from("agencies").delete().eq("id", agencyId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/agencies");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { ok: true };
}
