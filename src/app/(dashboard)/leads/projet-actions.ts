"use server";

// Actions de la fiche projet (back office v3). Les garde-fous sont ici, côté serveur :
// l'écran ne fait qu'expliquer un refus (docs refonte v3, §1.2).
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { contexteBo3, type Bo3Contexte } from "@/lib/bo3/acces";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { chargerAgences, chargerProjets, resoudreAgenceChoisie } from "@/lib/bo3/load";
import { briefToMarkdown, buildBrief, fuitesBrief, manqueDe } from "@/lib/bo3/projet";
import { colonnesDepuisTrame } from "@/lib/bo3/trame";
import type { BriefSection, Mention, Message, Projet, Trame } from "@/lib/bo3/types";

export type Resultat = { ok: true; info?: string; url?: string } | { ok: false; erreur: string };
const refus = (erreur: string): Resultat => ({ ok: false, erreur });

async function charger(id: string): Promise<{ ctx: Bo3Contexte; p: Projet } | Resultat> {
  const ctx = await contexteBo3();
  if (!ctx) return refus("Session expirée : reconnectez-vous.");
  const agences = await chargerAgences(ctx);
  const [p] = resoudreAgenceChoisie(await chargerProjets(ctx, { id }), agences);
  if (!p) return refus("Projet introuvable, ou hors de vos dossiers.");
  return { ctx, p };
}
const estErreur = (x: unknown): x is Resultat => !!x && typeof x === "object" && "ok" in x;

/** Toute écriture refusée par la base remonte : pas d'échec silencieux. */
function verifier<T extends { error: { message: string } | null }>(r: T): T {
  if (r.error) throw new Error(r.error.message);
  return r;
}

async function journal(ctx: Bo3Contexte, leadId: string, kind: string, message: Omit<Message, "t"> | null, extra: Record<string, unknown> = {}) {
  verifier(await ctx.supabase.from("activities").insert({
    lead_id: leadId,
    actor_id: ctx.userId,
    kind,
    detail: message?.s ?? kind,
    payload: { ...(message ?? {}), ...extra },
  }));
}

/** Tant que personne n'a le dossier, celui qui agit le prend (les garde-fous historiques l'exigent). */
async function prendreDossier(ctx: Bo3Contexte, leadId: string) {
  if (!ctx.userId) return;
  await ctx.supabase.from("leads").update({ referent_id: ctx.userId, referent_assigned_at: new Date().toISOString() }).eq("id", leadId).is("referent_id", null);
}

async function statut(ctx: Bo3Contexte, leadId: string, vers: string, depuis?: string[]) {
  let q = ctx.supabase.from("leads").update({ status: vers }).eq("id", leadId);
  if (depuis) q = q.in("status", depuis);
  const { error } = await q;
  if (error) throw new Error(error.message);
}

function rafraichir(id: string) {
  for (const p of ["/inbox", "/leads", "/dashboard", `/leads/${id}`]) revalidatePath(p);
}

async function executer(id: string, fn: (ctx: Bo3Contexte, p: Projet) => Promise<Resultat | void>): Promise<Resultat> {
  try {
    // La relecture du dossier est dans le try : si elle échoue, l'opérateur voit un refus, pas une page cassée.
    const r = await charger(id);
    if (estErreur(r)) return r;
    await prendreDossier(r.ctx, id);
    const res = await fn(r.ctx, r.p);
    rafraichir(id);
    return res ?? { ok: true };
  } catch (e) {
    console.error("[projet-actions]", e);
    return refus("L'enregistrement a échoué. Rien n'a été envoyé.");
  }
}

// ---------------------------------------------------------------- voyageur
/** Première réponse humaine : arrête l'horloge 48 h du voyageur. L'envoi lui-même se fait par WhatsApp ou e-mail. */
export async function premiereReponse(id: string, texte: string, canal: string) {
  return executer(id, async (ctx, p) => {
    if (p.premiereReponse) return refus("La première réponse est déjà enregistrée.");
    if (!texte.trim()) return refus("Le message est vide.");
    await journal(ctx, id, "first_response", { k: "out", s: `Première réponse · ${canal}`, b: texte.trim() });
    return { ok: true, info: "Première réponse enregistrée. Horloge 48 h arrêtée." };
  });
}

/** Lien voyageur raccourci aux champs manquants. Ce message vaut première réponse. */
export async function demanderManque(id: string, texte: string) {
  return executer(id, async (ctx, p) => {
    const token = randomUUID();
    const expire = new Date(Date.now() + 30 * 24 * 36e5).toISOString();
    const { error } = await ctx.supabase.from("leads").update({ public_token: token, public_token_expires_at: expire, traveler_responses_submitted_at: null }).eq("id", id);
    if (error) throw new Error(error.message);
    const base = (process.env.NEXT_PUBLIC_TRAVELER_BASE_URL || "https://app.directionlalgerie.com").replace(/\/$/, "");
    const champs = p.manque.length ? `?champs=${p.manque.join(",")}` : "";
    const url = `${base}/q/${token}${champs}`;
    await journal(ctx, id, "traveler_link_sent", { k: "out", s: "Lien voyageur envoyé", b: texte.replace("{lien}", url).trim() }, { champs: p.manque });
    return { ok: true, info: "Lien créé. Ce message vaut première réponse.", url };
  });
}

/** Trame complétée (réponses du voyageur) ou construite (lead WhatsApp / saisi). */
export async function enregistrerTrame(id: string, trame: Trame, origine: "reponses" | "qualification") {
  return executer(id, async (ctx) => {
    const { data } = verifier(await ctx.supabase.from("leads").select("ai_qualification_payload").eq("id", id).maybeSingle());
    const payload = { ...((data?.ai_qualification_payload as Record<string, unknown>) ?? {}), trame_v3: trame };
    const { error } = await ctx.supabase.from("leads").update({ ai_qualification_payload: payload, ...colonnesDepuisTrame(trame) }).eq("id", id);
    if (error) throw new Error(error.message);
    const reste = manqueDe(trame);
    if (origine === "reponses") await journal(ctx, id, "traveler_answers", { k: "in", s: "Réponses du voyageur", b: reste.length ? `Il manque encore : ${reste.join(", ")}.` : "Projet complet." });
    return { ok: true, info: reste.length ? `Trame enregistrée. Il manque encore : ${reste.join(", ")}.` : "Projet complet. Le brief peut partir." };
  });
}

export async function validerBlocQualification(id: string, index: number) {
  return executer(id, async (ctx) => {
    const cles = ["vibes", "group", "timing", "stay", "highlights", "budget"];
    const cle = cles[index];
    if (!cle) return refus("Bloc inconnu.");
    const { data } = verifier(await ctx.supabase.from("leads").select("qualification_blocks").eq("id", id).maybeSingle());
    const blocs = { ...((data?.qualification_blocks as Record<string, Record<string, unknown>>) ?? {}) };
    blocs[cle] = { ai_status: "validated", ai_suggestions: [], ai_confidence: null, ai_missing: [], op_selections: null, ...(blocs[cle] ?? {}), op_action: "manual", op_validated_at: new Date().toISOString() };
    const { error } = await ctx.supabase.from("leads").update({ qualification_blocks: blocs }).eq("id", id);
    if (error) throw new Error(error.message);
  });
}

export async function noteInterne(id: string, texte: string) {
  return executer(id, async (ctx) => {
    const { error } = await ctx.supabase.from("leads").update({ internal_notes: texte }).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true, info: "Note enregistrée." };
  });
}

// ---------------------------------------------------------------- brief
export async function genererBrief(id: string) {
  return executer(id, async (ctx, p) => {
    if (!p.trame) return refus("Pas de trame : construisez-la d'abord.");
    if (p.manque.length) return refus(`Le brief attend un projet complet. Il manque : ${p.manque.join(", ")}.`);
    const now = new Date().toISOString();
    const { error } = await ctx.supabase.from("leads").update({ generated_brief: briefToMarkdown(buildBrief(p)), brief_generated_at: now, brief_edited_at: now }).eq("id", id);
    if (error) throw new Error(error.message);
    await statut(ctx, id, "agency_assignment", ["new", "qualification", "refinement"]);
    return { ok: true, info: "Brief généré depuis la trame. Relisez avant d'envoyer." };
  });
}

export async function modifierBrief(id: string, sections: BriefSection[]) {
  return executer(id, async (ctx, p) => {
    if (!p.brief) return refus("Aucun brief à modifier.");
    const { error } = await ctx.supabase.from("leads").update({ generated_brief: briefToMarkdown(sections), brief_edited_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
  });
}

/** Envoi (copier-coller + « envoyé ») à une ou plusieurs agences : l'horloge agence démarre. */
export async function envoyerBrief(id: string, envois: { agence: string; portion: string }[]) {
  return executer(id, async (ctx, p) => {
    if (!p.brief || !p.brief.sections.length) return refus("Générez et relisez le brief avant l'envoi.");
    const fuites = fuitesBrief(p.brief.sections, p);
    if (fuites.length) return refus(`Le brief contient ${fuites.join(", ")}. Corrigez avant l'envoi : rien ne part.`);
    const nouveaux = envois.filter((e) => !p.consultations.some((c) => c.agence === e.agence));
    if (!nouveaux.length) return refus("Choisissez au moins une agence.");
    const now = new Date().toISOString();
    const { error } = await ctx.supabase.from("lead_circuit_proposals").insert(
      nouveaux.map((e) => ({
        lead_id: id,
        agency_id: e.agence,
        title: p.trame?.titre ?? "Proposition de circuit",
        circuit_outline: briefToMarkdown(p.brief!.sections),
        status: "awaiting_response",
        brief_sent_at: now,
        created_by_profile_id: ctx.userId,
        agency_proposal_payload: { portion: e.portion, reminders: [] },
      })),
    );
    if (error) throw new Error(error.message);
    await statut(ctx, id, "agency_assignment", ["new", "qualification", "refinement"]);
    await journal(ctx, id, "brief_sent", { k: "sys", s: "Brief envoyé", b: `${nouveaux.length} agence${nouveaux.length > 1 ? "s" : ""} · réponse attendue sous 48 h.` });
    return { ok: true, info: `Brief marqué envoyé à ${nouveaux.length} agence${nouveaux.length > 1 ? "s" : ""}. Horloge agence démarrée.` };
  });
}

// ---------------------------------------------------------------- agences
async function majConsultation(ctx: Bo3Contexte, p: Projet, propId: string, maj: (payload: Record<string, unknown>) => Record<string, unknown>) {
  if (!p.consultations.some((c) => c.id === propId)) throw new Error("consultation inconnue");
  const { data } = verifier(await ctx.supabase.from("lead_circuit_proposals").select("agency_proposal_payload").eq("id", propId).maybeSingle());
  const payload = { ...((data?.agency_proposal_payload as Record<string, unknown>) ?? {}) };
  const { error } = await ctx.supabase.from("lead_circuit_proposals").update(maj(payload)).eq("id", propId);
  if (error) throw new Error(error.message);
}

export async function accuseAgence(id: string, propId: string) {
  return executer(id, async (ctx, p) => {
    await majConsultation(ctx, p, propId, (pl) => ({ agency_proposal_payload: { ...pl, acknowledged_at: new Date().toISOString() } }));
    return { ok: true, info: "Accusé de réception noté." };
  });
}

export async function relancerAgence(id: string, propId: string) {
  return executer(id, async (ctx, p) => {
    await majConsultation(ctx, p, propId, (pl) => ({ agency_proposal_payload: { ...pl, reminders: [...(Array.isArray(pl.reminders) ? pl.reminders : []), new Date().toISOString()] } }));
    return { ok: true, info: "Relance datée." };
  });
}

export async function refusAgence(id: string, propId: string) {
  return executer(id, async (ctx, p) => {
    await majConsultation(ctx, p, propId, () => ({ proposal_declined_at: new Date().toISOString(), status: "declined" }));
    if (p.consultations.some((c) => c.id !== propId && c.proposition && !c.refus)) await statut(ctx, id, "co_construction", ["agency_assignment"]);
    return { ok: true, info: "Refus enregistré." };
  });
}

export async function saisirProposition(id: string, propId: string, v: { prix: number; duree: number; resume: string; ecarts: string }) {
  return executer(id, async (ctx, p) => {
    if (!(v.prix > 0)) return refus("Indiquez le prix par personne.");
    const now = new Date().toISOString();
    await majConsultation(ctx, p, propId, (pl) => ({
      proposal_received_at: now,
      status: "submitted",
      agency_proposal_price: v.prix,
      agency_proposal_duration_days: v.duree || null,
      agency_proposal_summary: v.resume.trim(),
      agency_proposal_payload: { ...pl, ecarts: v.ecarts.trim(), acknowledged_at: pl.acknowledged_at ?? now },
    }));
    await statut(ctx, id, "co_construction", ["agency_assignment"]);
    await journal(ctx, id, "agency_proposal", { k: "sys", s: "Proposition d'agence reçue", b: `${v.prix.toLocaleString("fr-FR")} € / pers.${v.duree ? ` · ${v.duree} jours` : ""}` });
    return { ok: true, info: "Proposition enregistrée." };
  });
}

export async function retenirProposition(id: string, propId: string) {
  return executer(id, async (ctx, p) => {
    const c = p.consultations.find((x) => x.id === propId);
    if (!c?.proposition) return refus("Cette agence n'a pas encore proposé.");
    verifier(await ctx.supabase.from("lead_circuit_proposals").update({ status: "submitted" }).eq("lead_id", id).eq("status", "approved"));
    verifier(await ctx.supabase.from("lead_circuit_proposals").update({ status: "approved", approved_at: new Date().toISOString(), approved_by_profile_id: ctx.userId }).eq("id", propId));
    verifier(await ctx.supabase.from("leads").update({ retained_agency_id: c.agence }).eq("id", id));
    await statut(ctx, id, "co_construction", ["agency_assignment"]);
    return { ok: true, info: "Proposition retenue." };
  });
}

/** Le devis agence devient une proposition Direction l'Algérie. Le voyageur ne reçoit jamais le devis brut. */
export async function convertirProposition(id: string, propId: string, v: { titre: string; prix: number; lignes: string[]; validite: number; note: string; mention: Mention }) {
  return executer(id, async (ctx, p) => {
    const c = p.consultations.find((x) => x.id === propId);
    if (!c?.proposition) return refus("Cette agence n'a pas encore proposé.");
    if (!v.titre.trim() || !(v.prix > 0)) return refus("Titre et prix par personne sont obligatoires.");
    if (p.devis?.envoye) return refus("La proposition a déjà été envoyée au voyageur.");
    const items = { v: 3, titre: v.titre.trim(), lignes: v.lignes.map((l) => l.trim()).filter(Boolean), prix: v.prix, validite: v.validite || 15, note: v.note.trim(), mention: v.mention, agence_id: c.agence, proposition_id: c.id };
    let quoteId = p.devis?.id ?? null;
    if (quoteId) {
      const { error } = await ctx.supabase.from("quotes").update({ items, summary: items.titre }).eq("id", quoteId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await ctx.supabase.from("quotes").insert({ lead_id: id, kind: "da_traveler", status: "draft", workflow_status: "draft", is_traveler_visible: true, summary: items.titre, items }).select("id").single();
      if (error) throw new Error(error.message);
      quoteId = String(data.id);
    }
    verifier(await ctx.supabase.from("lead_circuit_proposals").update({ status: "submitted", converted_quote_id: null }).eq("lead_id", id).eq("status", "approved").neq("id", propId));
    verifier(await ctx.supabase.from("lead_circuit_proposals").update({ status: "approved", converted_quote_id: quoteId, approved_at: new Date().toISOString(), approved_by_profile_id: ctx.userId }).eq("id", propId));
    verifier(await ctx.supabase.from("leads").update({ retained_agency_id: c.agence }).eq("id", id));
    await statut(ctx, id, "co_construction", ["agency_assignment"]);
    await journal(ctx, id, "quote_converted", { k: "sys", s: "Devis agence converti", b: `Proposition Direction l'Algérie · ${v.prix.toLocaleString("fr-FR")} € / pers.` });
    return { ok: true, info: "Devis converti en proposition Direction l'Algérie." };
  });
}

export async function envoyerProposition(id: string, canal: string) {
  return executer(id, async (ctx, p) => {
    if (!p.devis) return refus("Convertissez d'abord une proposition d'agence.");
    if (p.devis.envoye) return refus("Déjà envoyée.");
    const now = new Date().toISOString();
    // La base n'accepte que ces trois valeurs (contrainte quotes_sent_via_check).
    const via = /whats/i.test(canal) ? "whatsapp" : /mail/i.test(canal) ? "email" : "manual";
    const { error } = await ctx.supabase.from("quotes").update({ sent_at: now, sent_via: via, workflow_status: "sent", status: "sent" }).eq("id", p.devis.id);
    if (error) throw new Error(error.message);
    await statut(ctx, id, "quote", ["co_construction", "agency_assignment"]);
    await journal(ctx, id, "quote_sent", { k: "out", s: `Proposition envoyée · ${canal}`, b: `${p.devis.titre} · ${p.devis.prix.toLocaleString("fr-FR")} € / pers.` });
    return { ok: true, info: "Proposition envoyée au voyageur." };
  });
}

export async function relancerVoyageur(id: string) {
  return executer(id, async (ctx, p) => {
    if (p.relancesVoyageur.length >= 2) return refus("Deux relances déjà faites : clôturez ou marquez gagné.");
    const n = p.relancesVoyageur.length + 1;
    await journal(ctx, id, "traveler_reminder", { k: "out", s: `Relance ${n}`, b: "Avez-vous pu regarder la proposition ?" });
    return { ok: true, info: "Relance voyageur datée." };
  });
}

// ---------------------------------------------------------------- clôture
// Clôture : une seule fois. La condition sur le statut couvre aussi deux onglets ouverts sur le même dossier.
async function clore(ctx: Bo3Contexte, id: string, statut: "won" | "lost") {
  const { data, error } = await ctx.supabase.from("leads").update({ status: statut, closed_at: new Date().toISOString() })
    .eq("id", id).not("status", "in", "(won,lost)").select("id, contact_id");
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

export async function marquerGagne(id: string) {
  return executer(id, async (ctx, p) => {
    if (p.statut === "clos") return refus("Ce dossier est déjà clos.");
    if (!(await clore(ctx, id, "won"))) return refus("Ce dossier vient d'être clos par ailleurs.");
    if (p.devis) verifier(await ctx.supabase.from("quotes").update({ workflow_status: "won" }).eq("id", p.devis.id));
    await journal(ctx, id, "won", { k: "sys", s: "Dossier gagné", b: "Fiche contact créée." });
    return { ok: true, info: "Dossier gagné. Fiche contact créée." };
  });
}

export async function marquerPerdu(id: string, motif: string) {
  return executer(id, async (ctx, p) => {
    if (!motif.trim()) return refus("Le motif est obligatoire.");
    if (p.statut === "clos") return refus("Ce dossier est déjà clos.");
    const clos = await clore(ctx, id, "lost");
    if (!clos) return refus("Ce dossier vient d'être clos par ailleurs.");
    // Le déclencheur crée la fiche contact sans le motif (il lit les notes internes) : on l'y inscrit. Seul un admin
    // peut modifier une fiche contact (RLS) ; l'opérateur est déjà authentifié par contexteBo3, la clé de service
    // ne sert qu'à cette écriture.
    const { data: lead } = await ctx.supabase.from("leads").select("contact_id").eq("id", id).maybeSingle();
    if (lead?.contact_id) verifier(await createServiceRoleClient().from("contacts").update({ lost_reason: motif.trim() }).eq("id", lead.contact_id));
    if (p.devis) verifier(await ctx.supabase.from("quotes").update({ workflow_status: "lost" }).eq("id", p.devis.id));
    await journal(ctx, id, "lost", { k: "sys", s: "Dossier clos · perdu", b: `Motif : ${motif}` }, { motif });
    return { ok: true, info: "Dossier clos." };
  });
}
