// Lecture des projets depuis les tables existantes. Aucune colonne nouvelle : les données v3 vivent
// dans des champs JSON déjà présents (voir docs/REFONTE_V3.md, « Où vivent les données »).
import type { Bo3Contexte } from "./acces";
import type { Zone } from "./geo";
import { briefFromMarkdown, manqueDe } from "./projet";
import { trameDepuisSite, trameInterne } from "./trame";
import type { Agence, Canal, Consultation, DevisDA, Mention, Message, Projet, Source, Statut, Trame } from "./types";

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const o = (v: unknown): Row => (v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {});
const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

const slug = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------------------------------------------------------------- agences
/** Zones par agence. L'Ouest est couvert par les trois (décision du 26/09 : elles savent le proposer). */
function zonesAgence(r: Row): Zone[] {
  const declarees = o(r.circuits_data).zones;
  if (Array.isArray(declarees) && declarees.length) return declarees as Zone[];
  // Mots entiers (ou débuts de mot) : « est » ne doit pas se lire dans « destinations » ou « ouest ».
  const mots = slug([r.trade_name, r.legal_name, r.city, r.destinations].map(s).join(" ")).split("-");
  const a = (...racines: string[]) => mots.some((m) => racines.some((x) => m === x || (x.length > 4 && m.startsWith(x))));
  const z = new Set<Zone>();
  if (a("djanet", "tassili", "sahara", "tamanrasset", "hoggar", "riwaya", "ghardaia", "timimoun", "saoura", "mzab")) z.add("sahara");
  if (a("est", "constantine", "constantinois", "annaba", "aures", "setif", "jijel", "med")) z.add("est");
  if (a("alger", "algiers", "nord", "tipaza", "depaysement", "dapaysement")) z.add("nord");
  if (a("kabylie", "bejaia", "tizi", "djurdjura", "depaysement", "dapaysement")) z.add("kabylie");
  if (a("oran", "oranie", "tlemcen", "ouest")) z.add("ouest");
  // Décision du 26/09 : l'Ouest est couvert, les agences savent le proposer.
  z.add("ouest");
  return [...z];
}

// ---------------------------------------------------------------- lectures
// PostgREST rend au plus 1000 lignes par requête, sans le signaler : on lit par pages. Une erreur arrête le chargement
// (page d'erreur) plutôt que d'afficher des dossiers incomplets comme s'ils étaient justes.
type Reponse = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
async function tout(requete: (de: number, a: number) => Reponse): Promise<Row[]> {
  const lignes: Row[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await requete(de, de + 999);
    if (error) throw new Error(error.message);
    lignes.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) return lignes;
  }
}
/** Identifiants par paquets : la liste passe dans l'adresse de la requête, qui ne peut pas grandir sans fin. */
const paquets = (ids: string[], taille = 150) => Array.from({ length: Math.ceil(ids.length / taille) }, (_, i) => ids.slice(i * taille, (i + 1) * taille));

export async function chargerAgences(ctx: Bo3Contexte): Promise<Agence[]> {
  const data = await tout((de, a) => ctx.supabase
    .from("agencies")
    .select("id, legal_name, trade_name, city, destinations, email, phone, contact_name, status, circuits_data")
    .neq("status", "suspended")
    .order("legal_name").order("id")
    .range(de, a));
  return data.map((r: Row) => {
    const nom = s(r.trade_name) || s(r.legal_name);
    return { id: s(r.id), slug: slug(nom), n: nom, ville: s(r.city), zones: zonesAgence(r), contact: s(r.email), tel: s(r.phone) };
  });
}

// ---------------------------------------------------------------- projets
const LEAD_COLS =
  "id, reference, traveler_name, email, phone, status, source, page_origin, intake_channel, channel, preferred_channel, intake_payload, ai_qualification_payload, trip_summary, project_description, internal_notes, created_at, closed_at, welcome_email_sent_at, generated_brief, brief_generated_at, brief_edited_at, retained_agency_id, qualification_blocks, deleted_at";

function sourceDe(r: Row): Source {
  const origine = s(r.page_origin) + " " + s(r.source);
  if (/composer/i.test(origine)) return "composer";
  if (/mon-projet/i.test(origine)) return "mon-projet";
  if (s(r.intake_channel) === "whatsapp" || s(r.channel) === "whatsapp") return "whatsapp";
  if (s(r.intake_channel) === "web_form") return "mon-projet";
  return "manuel";
}

function statutDe(db: string, trame: Trame | null, manque: string[], consultations: Consultation[]): Statut {
  if (db === "won" || db === "lost") return "clos";
  if (db === "quote" || db === "negotiation") return "proposee";
  if (db === "co_construction") return "proposition";
  if (db === "agency_assignment") return consultations.length ? "envoye" : "brief_pret";
  return !trame || manque.length ? "a_completer" : "recu";
}

function devisDe(q: Row): DevisDA {
  const it = o(q.items);
  const v3 = it.v === 3;
  const lignesLegacy = Array.isArray(q.items) ? (q.items as Row[]).map((l) => [s(l.label), s(l.detail)].filter(Boolean).join(" : ")) : [];
  return {
    id: s(q.id),
    source: v3 ? s(it.agence_id) || null : null,
    mention: (v3 ? (s(it.mention) as Mention) : "aucune") || "aucune",
    prix: v3 ? Number(it.prix) || 0 : 0,
    titre: v3 ? s(it.titre) : s(q.summary) || "Proposition Direction l'Algérie",
    lignes: v3 && Array.isArray(it.lignes) ? (it.lignes as unknown[]).map(s) : lignesLegacy,
    validite: v3 ? Number(it.validite) || 15 : 15,
    note: v3 ? s(it.note) : "",
    converti: s(q.created_at),
    envoye: q.sent_at ? s(q.sent_at) : null,
    canal: q.sent_via ? ({ whatsapp: "WhatsApp", email: "e-mail", manual: "à la main" } as Record<string, string>)[s(q.sent_via)] ?? s(q.sent_via) : null,
  };
}

/** Évènements du journal qui sont des messages (payload.k) ou des jalons du dossier. */
const ACT_KINDS = ["first_response", "traveler_link_sent", "traveler_answers", "traveler_reminder", "ack_sent", "brief_sent", "agency_proposal", "quote_converted", "quote_sent", "won", "lost", "whatsapp_in", "message"];

export async function chargerProjets(ctx: Bo3Contexte, opts: { id?: string } = {}): Promise<Projet[]> {
  const rows = await tout((de, a) => {
    let q = ctx.supabase.from("leads").select(LEAD_COLS).is("deleted_at", null).order("created_at", { ascending: false }).order("id");
    if (opts.id) q = q.eq("id", opts.id);
    return q.range(de, a);
  });
  if (!rows.length) return [];
  const ids = rows.map((r) => s(r.id));

  const lire = async (requete: (lot: string[], de: number, a: number) => Reponse) =>
    (await Promise.all(paquets(ids).map((lot) => tout((de, a) => requete(lot, de, a))))).flat();
  const [props, quotes, acts] = await Promise.all([
    lire((lot, de, a) => ctx.supabase
      .from("lead_circuit_proposals")
      .select("id, lead_id, agency_id, status, brief_sent_at, proposal_received_at, proposal_declined_at, agency_proposal_price, agency_proposal_duration_days, agency_proposal_summary, agency_proposal_payload, converted_quote_id, created_at")
      .in("lead_id", lot)
      .not("brief_sent_at", "is", null)
      .order("brief_sent_at").order("id")
      .range(de, a)),
    lire((lot, de, a) => ctx.supabase.from("quotes").select("id, lead_id, kind, summary, items, created_at, sent_at, sent_via").in("lead_id", lot).eq("kind", "da_traveler").order("created_at").order("id").range(de, a)),
    lire((lot, de, a) => ctx.supabase.from("activities").select("lead_id, kind, detail, payload, created_at").in("lead_id", lot).in("kind", ACT_KINDS).order("created_at").order("id").range(de, a)),
  ]);

  const parLead = <T extends Row>(liste: T[] | null) => {
    const m = new Map<string, T[]>();
    for (const r of liste ?? []) { const k = s(r.lead_id); m.set(k, [...(m.get(k) ?? []), r]); }
    return m;
  };
  // Lues en plusieurs paquets : on remet chaque liste dans l'ordre du temps.
  const chrono = (k: string) => (x: Row, y: Row) => Date.parse(s(x[k])) - Date.parse(s(y[k]));
  const P = parLead(props.sort(chrono("brief_sent_at"))), Q = parLead(quotes.sort(chrono("created_at"))), A = parLead(acts.sort(chrono("created_at")));

  return rows.map((r) => {
    const id = s(r.id);
    const intake = o(r.intake_payload);
    const trame = trameInterne(o(r.ai_qualification_payload).trame_v3) ?? trameDepuisSite(intake.trame);
    const manque = manqueDe(trame);
    const acts = A.get(id) ?? [];
    const premiere = acts.find((a) => ["first_response", "traveler_link_sent"].includes(s(a.kind)));
    const consultations: Consultation[] = (P.get(id) ?? []).map((c) => {
      const pl = o(c.agency_proposal_payload);
      const recu = c.proposal_received_at ? s(c.proposal_received_at) : null;
      return {
        id: s(c.id),
        agence: s(c.agency_id),
        portion: s(pl.portion) || "tout",
        envoye: s(c.brief_sent_at),
        accuse: pl.acknowledged_at ? s(pl.acknowledged_at) : null,
        proposition: recu ? { recu, prix: n(c.agency_proposal_price), duree: n(c.agency_proposal_duration_days), resume: s(c.agency_proposal_summary), ecarts: s(pl.ecarts) } : null,
        refus: c.proposal_declined_at ? s(c.proposal_declined_at) : null,
        relances: Array.isArray(pl.reminders) ? (pl.reminders as unknown[]).map(s) : [],
        retenue: s(c.status) === "approved" || (!!r.retained_agency_id && s(r.retained_agency_id) === s(c.agency_id) && !c.proposal_declined_at),
        quoteId: c.converted_quote_id ? s(c.converted_quote_id) : null,
      };
    });
    const quotesLead = Q.get(id) ?? [];
    const devis = quotesLead.length ? devisDe(quotesLead[quotesLead.length - 1]) : null;
    const messages: Message[] = acts
      .filter((a) => o(a.payload).k)
      .map((a) => ({ t: s(a.created_at), k: s(o(a.payload).k) as Message["k"], s: s(o(a.payload).s) || s(a.detail), b: s(o(a.payload).b) }));
    if (!messages.length) messages.push({ t: s(r.created_at), k: "sys", s: "Projet reçu", b: sourceDe(r) === "whatsapp" ? "Premier message WhatsApp." : "Arrivé par le site." });
    const dbStatus = s(r.status);
    const perdu = acts.filter((a) => s(a.kind) === "lost").pop();
    const blocs = o(r.qualification_blocks);
    const qualification = ["vibes", "group", "timing", "stay", "highlights", "budget"].map((k, i) => (o(blocs[k]).op_action ? i : -1)).filter((i) => i >= 0);
    const texte = s(r.project_description) || s(r.trip_summary) || s(intake.project_notes_short) || "";
    const canalPref = (s(r.preferred_channel) || s(intake.follow_prefs)).toLowerCase();
    const choisie = s(o(intake.trame).agence_choisie);
    return {
      id,
      ref: s(r.reference) || `DA-${id.slice(0, 8).toUpperCase()}`,
      nom: s(r.traveler_name) || s(r.email) || "Voyageur",
      email: s(r.email) || null,
      tel: s(r.phone) || null,
      canal: (/whats/.test(canalPref) || sourceDe(r) === "whatsapp" ? "whatsapp" : "email") as Canal,
      source: sourceDe(r),
      statut: statutDe(dbStatus, trame, manque, consultations),
      dbStatus,
      recu: s(r.created_at),
      premiereReponse: premiere ? s(premiere.created_at) : r.welcome_email_sent_at ? s(r.welcome_email_sent_at) : null,
      agenceChoisie: choisie || null,
      trame,
      texte,
      manque,
      brief: r.generated_brief ? { sections: briefFromMarkdown(s(r.generated_brief)), editedAt: s(r.brief_edited_at) || s(r.brief_generated_at) || null } : null,
      consultations,
      devis,
      relancesVoyageur: acts.filter((a) => s(a.kind) === "traveler_reminder").map((a) => s(a.created_at)),
      messages,
      issue: dbStatus === "won" ? "gagne" : dbStatus === "lost" ? "perdu" : null,
      motif: perdu ? s(o(perdu.payload).motif) || null : null,
      closedAt: r.closed_at ? s(r.closed_at) : null,
      notesInternes: s(r.internal_notes).replace(/^—$/, ""),
      qualification,
    } satisfies Projet;
  });
}

/** Les slugs d'agence du site (« riwaya-travel ») deviennent les identifiants de la base. */
export function resoudreAgenceChoisie(projets: Projet[], agences: Agence[]): Projet[] {
  return projets.map((p) => {
    if (!p.agenceChoisie) return p;
    const a = agences.find((x) => x.id === p.agenceChoisie || x.slug === p.agenceChoisie || x.slug.startsWith(p.agenceChoisie ?? "") || (p.agenceChoisie ?? "").startsWith(x.slug));
    return { ...p, agenceChoisie: a?.id ?? null };
  });
}
