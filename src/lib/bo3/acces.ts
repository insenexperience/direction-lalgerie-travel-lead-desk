import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type Bo3Contexte = {
  supabase: SupabaseClient;
  userId: string | null;
  nom: string;
  role: string | null;
  /** Aperçu local sans connexion : jamais actif hors `next dev`. */
  apercu: boolean;
};

/**
 * Aperçu local : permet de vérifier les écrans en développement sans session.
 * Double verrou : NODE_ENV (toujours « production » sur Vercel, build compris) et une variable explicite.
 */
export const apercuLocalActif = () => process.env.NODE_ENV === "development" && process.env.BO3_APERCU_LOCAL === "1";

export async function contexteBo3(): Promise<Bo3Contexte | null> {
  if (apercuLocalActif()) {
    const supabase = createServiceRoleClient();
    const { data } = await supabase.from("profiles").select("id, full_name, role").eq("role", "admin").limit(1).maybeSingle();
    return { supabase, userId: (data?.id as string) ?? null, nom: (data?.full_name as string) || "Aperçu local", role: "admin", apercu: true };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
  return {
    supabase,
    userId: user.id,
    nom: (data?.full_name as string) || user.email?.split("@")[0] || "Opérateur",
    role: (data?.role as string) ?? null,
    apercu: false,
  };
}
