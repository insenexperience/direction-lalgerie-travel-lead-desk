"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/is-uuid";

export type ActionResult = { ok: true; url?: string } | { ok: false; error: string };

const BUCKET = "agency_logos";
const MAX_SIZE = 2 * 1024 * 1024; // 2 Mo
const ALLOWED_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

export async function uploadAgencyLogo(agencyId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };
  if (!isUuid(agencyId)) return { ok: false, error: "Identifiant invalide." };

  const file = formData.get("file") as File | null;
  if (!file) return { ok: false, error: "Aucun fichier fourni." };
  if (!ALLOWED_MIMES.has(file.type)) return { ok: false, error: "Format non supporté. Utilisez PNG, JPEG, WebP ou SVG." };
  if (file.size > MAX_SIZE) return { ok: false, error: "Le fichier dépasse 2 Mo." };

  const ext = file.name.split(".").pop() ?? "png";
  const path = `${agencyId}/logo-${Date.now()}.${ext}`;

  const admin = createServiceRoleClient();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { error: updateError } = await supabase
    .from("agencies")
    .update({ logo_storage_path: path, logo_updated_at: new Date().toISOString() })
    .eq("id", agencyId);

  if (updateError) return { ok: false, error: updateError.message };

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

  revalidatePath(`/agencies/${agencyId}`);
  revalidatePath("/agencies");
  revalidatePath("/dashboard");
  return { ok: true, url };
}

export async function removeAgencyLogo(agencyId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };
  if (!isUuid(agencyId)) return { ok: false, error: "Identifiant invalide." };

  // Get current path
  const { data: agency } = await supabase.from("agencies").select("logo_storage_path").eq("id", agencyId).single();
  if (agency?.logo_storage_path) {
    const admin = createServiceRoleClient();
    await admin.storage.from(BUCKET).remove([agency.logo_storage_path]);
  }

  const { error } = await supabase
    .from("agencies")
    .update({ logo_storage_path: null, logo_updated_at: null })
    .eq("id", agencyId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/agencies/${agencyId}`);
  revalidatePath("/agencies");
  revalidatePath("/dashboard");
  return { ok: true };
}
