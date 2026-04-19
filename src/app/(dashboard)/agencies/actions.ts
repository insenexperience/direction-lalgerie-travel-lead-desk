"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import type { CreatePartnerAgencyInput } from "@/lib/mock-agencies";

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
