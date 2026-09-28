import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isTokenExpired } from "@/lib/traveler-requalification";
import { isUuid } from "@/lib/is-uuid";
import { champsDepuis, completerTrame, lireReponsesChamps, resumeReponses } from "@/lib/bo3/champs-voyageur";
import { manqueDe } from "@/lib/bo3/projet";
import { colonnesDepuisTrame, trameDepuisSite, trameInterne, trameVide } from "@/lib/bo3/trame";

export const runtime = "nodejs";

type Brut = Record<string, unknown>;
const obj = (v: unknown): Brut => (v && typeof v === "object" && !Array.isArray(v) ? (v as Brut) : {});

/**
 * Réponses du formulaire raccourci aux champs manquants (`/q/<token>?champs=…`).
 * Elles complètent la trame du projet (ai_qualification_payload.trame_v3) ; le formulaire long garde sa route.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!isUuid(token)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const demandes = champsDepuis(typeof obj(corps).champs === "string" ? String(obj(corps).champs) : "");

  try {
    const supabase = createServiceRoleClient();
    const { data: lead, error: lectureErr } = await supabase
      .from("leads")
      .select("id, status, deleted_at, public_token_expires_at, traveler_responses_submitted_at, intake_payload, ai_qualification_payload")
      .eq("public_token", token)
      .maybeSingle();
    if (lectureErr) throw lectureErr;
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (isTokenExpired(lead.public_token_expires_at as string | null)) return NextResponse.json({ error: "Expired" }, { status: 410 });
    // Dossier clos ou supprimé : le lien ne sert plus.
    if (lead.deleted_at || lead.status === "won" || lead.status === "lost") return NextResponse.json({ error: "Closed" }, { status: 410 });
    if (lead.traveler_responses_submitted_at) return NextResponse.json({ error: "Already submitted" }, { status: 409 });

    const qualif = obj(lead.ai_qualification_payload);
    const avant = trameInterne(qualif.trame_v3) ?? trameDepuisSite(obj(lead.intake_payload).trame) ?? trameVide();
    // Seuls les champs que le lien demande ET qui manquent encore : une adresse retouchée à la main ne peut pas
    // écraser ce que l'opérateur a déjà saisi.
    const encoreManquants = manqueDe(avant)
    const reponses = lireReponsesChamps(corps, demandes.filter((c) => encoreManquants.includes(c)));
    if (!Object.keys(reponses).length) return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
    const trame = completerTrame(avant, reponses);
    const now = new Date().toISOString();

    // Envoi unique, même depuis deux onglets : l'écriture n'a lieu que si rien n'a encore été envoyé.
    const { data: ecrit, error } = await supabase
      .from("leads")
      .update({ ai_qualification_payload: { ...qualif, trame_v3: trame }, ...colonnesDepuisTrame(trame), traveler_responses_submitted_at: now })
      .eq("id", String(lead.id))
      .is("traveler_responses_submitted_at", null)
      .select("id");
    if (error) throw error;
    if (!ecrit?.length) return NextResponse.json({ error: "Already submitted" }, { status: 409 });

    const reste = manqueDe(trame);
    const { error: journalErr } = await supabase.from("activities").insert({
      lead_id: String(lead.id),
      kind: "traveler_answers",
      detail: "Réponses du voyageur",
      payload: { k: "in", s: "Réponses du voyageur", b: `${resumeReponses(reponses)}${reste.length ? ` — il manque encore : ${reste.join(", ")}.` : ""}` },
    });
    // La trame est à jour : un fil incomplet ne doit pas faire croire au voyageur que rien n'est parti.
    if (journalErr) console.error("[api/q/champs] journal", journalErr);

    for (const p of ["/inbox", "/leads", "/dashboard", `/leads/${String(lead.id)}`]) revalidatePath(p);
    return NextResponse.json({ ok: true, reste });
  } catch (e) {
    console.error("[api/q/champs] POST", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
