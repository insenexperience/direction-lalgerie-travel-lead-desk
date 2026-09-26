import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Garde la base Supabase éveillée.
 *
 * Un projet Supabase gratuit sans activité pendant quelques jours est mis en
 * pause : le CRM ne peut alors plus ni lire ni enregistrer de leads (constaté
 * le 26/09/2026). Vercel appelle cette route une fois par jour (vercel.json),
 * et une lecture minimale suffit à compter comme activité.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel signe ses appels planifiés avec CRON_SECRET ; sans lui, la route
  // resterait une porte d'entrée publique vers la base.
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { count, error } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true });
    if (error) {
      console.error("[cron/keepalive] lecture", error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    return NextResponse.json({ ok: true, leads: count ?? 0 });
  } catch (e) {
    console.error("[cron/keepalive]", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
