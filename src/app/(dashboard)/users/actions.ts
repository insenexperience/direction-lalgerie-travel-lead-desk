"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export async function updateProfile(
  targetUserId: string,
  patch: { full_name?: string; role?: "admin" | "lead_referent" },
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  // Check caller's role
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = me?.role === "admin";

  if (!isAdmin) {
    // Bootstrap: allow if no admin exists yet AND user is updating themselves
    const { count } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    const noAdmins = (count ?? 0) === 0;
    if (!noAdmins || targetUserId !== user.id) {
      return { ok: false, error: "Action réservée aux administrateurs." };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", targetUserId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/users");
  return { ok: true };
}
