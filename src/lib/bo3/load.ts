// Lecture des projets depuis les tables existantes. Aucune colonne nouvelle : les données v3 vivent
// dans des champs JSON déjà présents (voir docs/REFONTE_V3.md, « Où vivent les données »).
import type { Bo3Contexte } from "./acces";
import type { Zone } from "./geo";
import { briefFromMarkdown, manqueDe } from "./projet";
import { trameDepuisSite, trameInterne } from "./trame";
import { formatQualificationBudget, readConfirmedQualificationBudget } from "@/lib/qualification-budget";
import { etapeAvecAvancementManuel } from "./manual-stage";
import type { Agence, Canal, Consultation, DevisDA, Mention, Message, Projet, ProjetListe, Source, Statut, Trame } from "./types";

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
  "id, updated_at, reference, traveler_name, email, phone, contact_id, status, source, page_origin, intake_channel, channel, preferred_channel, intake_payload, ai_qualification_payload, trip_summary, project_description, internal_notes, created_at, closed_at, welcome_email_sent_at, generated_brief, brief_generated_at, brief_edited_at, retained_agency_id, qualification_blocks, deleted_at";

const LIST_LEAD_COLS =
  "id, reference, traveler_name, email, status, source, page_origin, intake_channel, channel, intake_payload, trame_v3:ai_qualification_payload->trame_v3, trip_summary, project_description, created_at, closed_at, welcome_email_sent_at, retained_agency_id";

function sourceDe(r: Row): Source {
  const trame = o(o(r.intake_payload).trame);
  if (trame.type === "demande-projet-voyage" && trame.version === 1) return "demande-projet";
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
  if (db === "agency_assignment") return consultations.some((c) => !!c.envoye) ? "envoye" : "brief_pret";
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
const LIST_ACT_KINDS = ["first_response", "traveler_link_sent", "traveler_reminder", "email_sent", "email_sent_externally", "manual_stage_advanced", "lead_reset"];
const ACT_KINDS = [...LIST_ACT_KINDS, "traveler_answers", "ack_sent", "brief_sent", "agency_proposal", "quote_converted", "quote_sent", "won", "lost", "whatsapp_in", "message", "external_exchange", "traveler_link_created", "assistant_edit_applied", "qualification_budget_saved"];

async function construireProjets(ctx: Bo3Contexte, rows: Row[], liste = false): Promise<Projet[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => s(r.id));

  const lire = async (requete: (lot: string[], de: number, a: number) => Reponse) =>
    (await Promise.all(paquets(ids).map((lot) => tout((de, a) => requete(lot, de, a))))).flat();
  const [props, quotes, acts] = await Promise.all([
    lire((lot, de, a) => ctx.supabase
      .from("lead_circuit_proposals")
      .select(liste
        ? "id, lead_id, agency_id, status, brief_sent_at, proposal_received_at, proposal_declined_at, acknowledged_at:agency_proposal_payload->>acknowledged_at"
        : "id, lead_id, agency_id, status, brief_sent_at, proposal_received_at, proposal_declined_at, agency_proposal_price, agency_proposal_duration_days, agency_proposal_summary, agency_proposal_payload, converted_quote_id")
      .in("lead_id", lot)
      .not("brief_sent_at", "is", null)
      .order("brief_sent_at").order("id")
      .range(de, a)),
    lire((lot, de, a) => ctx.supabase.from("quotes").select(liste
      ? "id, lead_id, created_at, sent_at, version:items->v, agency_id:items->>agence_id"
      : "id, lead_id, summary, items, created_at, sent_at, sent_via")
      .in("lead_id", lot).eq("kind", "da_traveler").order("created_at").order("id").range(de, a)),
    lire((lot, de, a) => ctx.supabase.from("activities").select(liste
      ? "lead_id, kind, created_at, email_kind:payload->>email_kind, occurred_at:payload->>occurred_at, stage:payload->>stage, db_status:payload->>db_status"
      : "lead_id, kind, detail, payload, created_at")
      .in("lead_id", lot).in("kind", liste ? LIST_ACT_KINDS : ACT_KINDS).order("created_at").order("id").range(de, a)),
  ]);

  const parLead = (lignes: Row[]) => {
    const m = new Map<string, Row[]>();
    for (const r of lignes) {
      const id = s(r.lead_id);
      const groupe = m.get(id);
      if (groupe) groupe.push(r);
      else m.set(id, [r]);
    }
    return m;
  };
  // Chaque lead n'est présent que dans un seul paquet. L'ordre SQL est déjà chronologique pour son groupe.
  const P = parLead(props);
  const Q = parLead(quotes);
  const A = parLead(acts);

  return rows.map((row) => {
    const r: Row = liste ? { ...row, ai_qualification_payload: { trame_v3: row.trame_v3 } } : row;
    const id = s(r.id);
    const intake = o(r.intake_payload);
    const sourceTrame = trameInterne(o(r.ai_qualification_payload).trame_v3) ?? trameDepuisSite(intake.trame);
    const confirmedBudget = readConfirmedQualificationBudget(intake);
    const trame = sourceTrame && confirmedBudget
      ? { ...sourceTrame, budget: formatQualificationBudget(confirmedBudget) || null }
      : sourceTrame;
    const manque = manqueDe(sourceTrame);
    if (confirmedBudget) {
      const budgetIndex = manque.indexOf("budget");
      const budgetKnown = confirmedBudget.currency && confirmedBudget.unit && (confirmedBudget.min ?? confirmedBudget.max) !== null;
      if (budgetKnown && budgetIndex >= 0) manque.splice(budgetIndex, 1);
      if (!budgetKnown && budgetIndex < 0) manque.push("budget");
    }
    const activites = A.get(id) ?? [];
    const acts = liste ? activites.map<Row>((a) => ({ ...a, payload: { email_kind: a.email_kind, occurred_at: a.occurred_at, stage: a.stage, db_status: a.db_status } })) : activites;
    const cycleActs = acts.slice(acts.findLastIndex((a) => a.kind === "lead_reset") + 1);
    const premiere = cycleActs.find((a) => ["first_response", "traveler_link_sent"].includes(s(a.kind)) || (["email_sent", "email_sent_externally"].includes(s(a.kind)) && ["welcome", "qualification"].includes(s(o(a.payload).email_kind))));
    const consultations: Consultation[] = (P.get(id) ?? []).map((c) => {
      const pl = liste ? { acknowledged_at: c.acknowledged_at } : o(c.agency_proposal_payload);
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
    const dernierDevis = quotesLead.at(-1);
    const devis = dernierDevis ? devisDe(liste
      ? { ...dernierDevis, items: { v: dernierDevis.version, agence_id: dernierDevis.agency_id } }
      : dernierDevis) : null;
    const messages: Message[] = acts
      .filter((a) => o(a.payload).k)
      .map((a) => ({ t: s(a.created_at), k: s(o(a.payload).k) as Message["k"], s: s(o(a.payload).s) || s(a.detail), b: s(o(a.payload).b) }));
    if (!liste && !messages.length) messages.push({ t: s(r.created_at), k: "sys", s: "Projet reçu", b: sourceDe(r) === "whatsapp" ? "Premier message WhatsApp." : "Arrivé par le site." });
    const dbStatus = s(r.status);
    const perdu = acts.filter((a) => s(a.kind) === "lost").pop();
    const blocs = o(r.qualification_blocks);
    const qualification = ["vibes", "group", "timing", "stay", "highlights", "budget"].map((k, i) => (o(blocs[k]).op_action ? i : -1)).filter((i) => i >= 0);
    const texte = s(r.project_description) || s(r.trip_summary) || s(intake.project_notes_short) || "";
    const canalPref = (s(r.preferred_channel) || s(intake.follow_prefs)).toLowerCase();
    const choisie = s(o(intake.trame).agence_choisie);
    return {
      id,
      updatedAt: s(r.updated_at),
      ref: s(r.reference) || `DA-${id.slice(0, 8).toUpperCase()}`,
      nom: s(r.traveler_name) || s(r.email) || "Voyageur",
      email: s(r.email) || null,
      tel: s(r.phone) || null,
      contactId: s(r.contact_id) || null,
      canal: (/whats/.test(canalPref) || sourceDe(r) === "whatsapp" ? "whatsapp" : "email") as Canal,
      source: sourceDe(r),
      statut: etapeAvecAvancementManuel(statutDe(dbStatus, trame, manque, consultations), dbStatus, acts),
      dbStatus,
      recu: s(r.created_at),
      premiereReponse: premiere ? (s(o(premiere.payload).occurred_at) || s(premiere.created_at)) : r.welcome_email_sent_at ? s(r.welcome_email_sent_at) : null,
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

export async function chargerProjets(ctx: Bo3Contexte, { id }: { id?: string } = {}): Promise<Projet[]> {
  const rows = await tout((de, a) => {
    const q = ctx.supabase.from("leads").select(LEAD_COLS).is("deleted_at", null);
    return (id ? q.eq("id", id) : q.order("created_at", { ascending: false }).order("id")).range(de, a);
  });
  return construireProjets(ctx, rows);
}

export async function chargerProjetDepuisLigne(ctx: Bo3Contexte, row: Row): Promise<Projet> {
  const [projet] = await construireProjets(ctx, [row]);
  return projet;
}

export async function chargerProjetsListe(ctx: Bo3Contexte): Promise<ProjetListe[]> {
  const rows = await tout((de, a) => ctx.supabase.from("leads").select(LIST_LEAD_COLS).is("deleted_at", null)
    .order("created_at", { ascending: false }).order("id").range(de, a));
  const projets = await construireProjets(ctx, rows, true);
  return projets.map((p) => ({
    id: p.id, ref: p.ref, nom: p.nom, source: p.source, statut: p.statut, recu: p.recu, premiereReponse: p.premiereReponse,
    agenceChoisie: p.agenceChoisie, texte: p.texte, manque: p.manque, relancesVoyageur: p.relancesVoyageur, issue: p.issue, closedAt: p.closedAt,
    trame: p.trame ? {
      titre: p.trame.titre,
      cadre: { mois: p.trame.cadre.mois, duree: p.trame.cadre.duree },
      groupe: { nombre: p.trame.groupe.nombre },
      jours: p.trame.jours.map(({ lieux }) => ({ lieux: lieux.slice(0, 1) })),
    } : null,
    consultations: p.consultations.map(({ id, agence, envoye, accuse, refus, retenue, proposition }) => ({
      id, agence, envoye, accuse, refus, retenue, proposition: proposition ? { recu: proposition.recu } : null,
    })),
    devis: p.devis ? { source: p.devis.source, envoye: p.devis.envoye } : null,
  }));
}

/** Les slugs d'agence du site (« riwaya-travel ») deviennent les identifiants de la base. */
export function resoudreAgenceChoisie<T extends Pick<Projet, "agenceChoisie">>(projets: T[], agences: Agence[]): T[] {
  return projets.map((p) => {
    if (!p.agenceChoisie) return p;
    const a = agences.find((x) => x.id === p.agenceChoisie || x.slug === p.agenceChoisie || x.slug.startsWith(p.agenceChoisie ?? "") || (p.agenceChoisie ?? "").startsWith(x.slug));
    return { ...p, agenceChoisie: a?.id ?? null };
  });
}
