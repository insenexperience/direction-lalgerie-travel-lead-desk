"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/is-uuid";
import type { AgencyContactInput } from "@/lib/agencies/types";

export type ActionResult = { ok: true; contactId?: string } | { ok: false; error: string };

export async function addAgencyContact(agencyId: string, input: AgencyContactInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };
  if (!isUuid(agencyId)) return { ok: false, error: "Identifiant invalide." };

  const full_name = input.full_name.trim();
  if (!full_name) return { ok: false, error: "Le nom est obligatoire." };

  const { data, error } = await supabase.from("agency_contacts").insert({
    agency_id: agencyId,
    is_primary: input.is_primary ?? false,
    full_name,
    role: input.role?.trim() || null,
    email: input.email?.trim() || "",
    phone: input.phone?.trim() || "",
    whatsapp: input.whatsapp?.trim() || null,
    preferred_channel: input.preferred_channel ?? null,
    notes: input.notes?.trim() || null,
  }).select("id").single();

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/agencies/${agencyId}`);
  return { ok: true, contactId: data?.id };
}

export async function updateAgencyContact(id: string, input: AgencyContactInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };
  if (!isUuid(id)) return { ok: false, error: "Identifiant invalide." };

  const full_name = input.full_name.trim();
  if (!full_name) return { ok: false, error: "Le nom est obligatoire." };

  const { error } = await supabase.from("agency_contacts").update({
    full_name,
    role: input.role?.trim() || null,
    email: input.email?.trim() || "",
    phone: input.phone?.trim() || "",
    whatsapp: input.whatsapp?.trim() || null,
    preferred_channel: input.preferred_channel ?? null,
    notes: input.notes?.trim() || null,
  }).eq("id", id);

  if (error) return { ok: false, error: error.message };

  // Get agency_id for revalidation
  const { data: contact } = await supabase.from("agency_contacts").select("agency_id").eq("id", id).single();
  if (contact) revalidatePath(`/agencies/${contact.agency_id}`);

  return { ok: true };
}

export async function deleteAgencyContact(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };
  if (!isUuid(id)) return { ok: false, error: "Identifiant invalide." };

  const { data: contact } = await supabase.from("agency_contacts").select("agency_id, is_primary").eq("id", id).single();
  if (!contact) return { ok: false, error: "Contact introuvable." };
  if (contact.is_primary) return { ok: false, error: "Impossible de supprimer le contact principal. Définissez-en un autre d'abord." };

  const { error } = await supabase.from("agency_contacts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/agencies/${contact.agency_id}`);
  return { ok: true };
}

export async function setPrimaryAgencyContact(agencyId: string, contactId: string): Promise<ActionResult> {
  if (!isUuid(agencyId) || !isUuid(contactId)) return { ok: false, error: "Identifiant invalide." };

  const admin = createServiceRoleClient();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  // Two-step: reset all primaries for this agency, then set the new one
  const { error: resetError } = await admin
    .from("agency_contacts")
    .update({ is_primary: false })
    .eq("agency_id", agencyId)
    .eq("is_primary", true);

  if (resetError) return { ok: false, error: resetError.message };

  const { error: setError } = await admin
    .from("agency_contacts")
    .update({ is_primary: true })
    .eq("id", contactId)
    .eq("agency_id", agencyId);

  if (setError) return { ok: false, error: setError.message };

  revalidatePath(`/agencies/${agencyId}`);
  return { ok: true };
}
