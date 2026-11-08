import "server-only";
import { donneesBo3 } from "@/lib/bo3/donnees";
import { chargerAgences, chargerProjets } from "@/lib/bo3/load";
import type { Bo3Contexte } from "@/lib/bo3/acces";
import { fmtD, nextAction, statutLabel, urgency } from "@/lib/bo3/projet";
import { ZONES } from "@/lib/bo3/geo";
import { trameDepuisSite } from "@/lib/bo3/trame";
import type { Agence, Projet, Trame } from "@/lib/bo3/types";
import { anonymizeAgencyText, type LeadEmailTemplateInput } from "@/lib/email/lead-email-template";
import { isGmailReadRequest, type DeskInboundMail } from "@/lib/email/gmail-intake";
import { readDeskGmail } from "@/app/(dashboard)/leads/gmail-actions";
import { BASES, ORDRE, estBase } from "@/lib/radar/bases";
import { chargerRadar } from "@/lib/radar/donnees";
import { assistantLeadContext } from "./lead-context";
import { buildDeskProject, projectPrompt, type DeskActivity, type DeskFact, type DeskProjectReadout, type DeskTransition } from "./project-readout";
import { DESK_SURFACES, findDeskProjects, normalizeDeskQuery, projectDeskLink, type DeskScope } from "./scope";

export type DeskViewItem = { title: string; detail?: string; href?: string; tag?: string; reference?: string; draft?: string };
export type DeskView = {
  heading: string;
  summary: string;
  items: DeskViewItem[];
  stats?: DeskFact[];
  project?: DeskProjectReadout;
  choices?: boolean;
  related?: DeskViewItem[];
  inbound?: DeskInboundMail[];
};

const DAY = 86400000;
const dossierName = (p: Projet) => p.nom.includes("@") ? p.ref : p.nom;
const quoteDate = (p: Projet) => p.devis?.envoye && p.devis.validite > 0 ? Date.parse(p.devis.envoye) + p.devis.validite * DAY : null;
const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const leadItem = (p: Projet, detail?: string): DeskViewItem => ({
  title: dossierName(p), detail, reference: p.ref, tag: statutLabel(p), href: projectDeskLink(p.id),
});
const factLabels: Record<string, string> = {
  dates: "Période", duration: "Durée", participants: "Groupe", accommodation: "Hébergement", budget: "Budget",
};

function trameFacts(trame: Trame | null): DeskFact[] {
  if (!trame) return [];
  const facts = {
    "Période": [trame.cadre.mois, trame.cadre.souplesse].filter(Boolean).join(" · "),
    "Durée": trame.cadre.duree,
    "Hébergement": trame.cadre.hebergement,
    "Groupe": trame.groupe.nombre ? trame.groupe.nombre + " voyageur(s)" + (trame.groupe.enfants ? ", dont " + trame.groupe.enfants + " enfant(s)" : "") : trame.groupe.type,
    "Budget": trame.budget,
    "Destinations souhaitées": trame.destinations?.map(({ nom }) => nom).join(" · "),
    "Activités": trame.envies.activites.join(" · "),
    "Précisions de la trame": trame.precisions,
  };
  return Object.entries(facts).flatMap(([label, value]) => value ? [{ label, value }] : []);
}

function projectFacts(p: Projet, lead: LeadEmailTemplateInput) {
  const context = assistantLeadContext(lead);
  const intake = lead.intake_payload as { trame?: unknown } | null | undefined;
  const initial = trameFacts(trameDepuisSite(intake?.trame));
  if (context.initialRequest?.wishes.length) initial.push({ label: "Envies sélectionnées", value: context.initialRequest.wishes.join(" · ") });
  const facts = new Map<string, string>();
  for (const item of context.confirmed) if (item.value) facts.set(factLabels[item.id] ?? item.id, item.value);
  for (const fact of trameFacts(p.trame)) facts.set(fact.label, fact.value);
  if (p.manque.includes("budget")) facts.delete("Budget");
  if (context.missing.length) facts.set("Points à préciser", context.missing.map(({ label }) => label).join(" · "));
  return { facts: [...facts].map(([label, value]) => ({ label, value })), initial, qualification: context.derniereQualification };
}

async function projectEvidence(ctx: Bo3Contexte, p: Projet, agencies: Agence[], now: number, lead?: LeadEmailTemplateInput) {
  const [row, history, transitions, mail] = await Promise.all([
    lead ? Promise.resolve({ data: lead }) : ctx.supabase.from("leads").select("*").eq("id", p.id).is("deleted_at", null).maybeSingle(),
    ctx.supabase.from("activities").select("kind,created_at,payload").eq("lead_id", p.id)
      .order("created_at", { ascending: false }).limit(80).returns<DeskActivity[]>(),
    ctx.supabase.from("lead_history").select("to_stage,changed_at").eq("lead_id", p.id)
      .order("changed_at", { ascending: false }).limit(20).returns<DeskTransition[]>(),
    ctx.supabase.from("desk_gmail_messages").select("gmail_id", { count: "exact", head: true })
      .eq("lead_id", p.id).eq("kind", "agency_proposal"),
  ]);
  if (!row.data) return null;
  return buildDeskProject(p, agencies, {
    ...projectFacts(p, row.data), activities: history.data ?? [], transitions: transitions.data ?? [], gmailOffers: mail.count ?? 0,
  }, now);
}

export async function loadProjectForAssistant(ctx: Bo3Contexte, leadId: string, row: LeadEmailTemplateInput) {
  const [[project], agencies] = await Promise.all([chargerProjets(ctx, { id: leadId }), chargerAgences(ctx)]);
  return project ? projectEvidence(ctx, project, agencies, Date.now(), row) : null;
}

function quoteItems(projects: Projet[], now: number): DeskViewItem[] {
  return projects.filter(p => p.devis).map(p => {
    const quote = p.devis!;
    const end = quoteDate(p);
    const tag = p.statut === "clos" ? statutLabel(p) : end && end < now ? "Expiré" : quote.envoye ? "Envoyé" : "Brouillon";
    return {
      title: dossierName(p), reference: p.ref, tag, href: projectDeskLink(p.id, "props"),
      detail: [quote.prix > 0 ? money.format(quote.prix) : null, quote.envoye ? "Envoyé le " + fmtD(quote.envoye) : null,
        end ? "Valable jusqu’au " + fmtD(new Date(end).toISOString()) : null].filter(Boolean).join(" · "),
    };
  });
}

function fileItems(projects: Projet[], agencies: Agence[], now: number, relances = false) {
  return projects.filter(p => p.statut !== "clos").sort((a, b) => urgency(a, now) - urgency(b, now)).slice(0, 12).map(p => {
    const next = nextAction(p, agencies, now);
    const item = leadItem(p, next.t + " · " + next.s);
    if (!relances) return item;
    if (p.statut === "envoye" && (!p.consultations.some(c => c.envoye) || p.consultations.some(c => c.envoye && !c.proposition && !c.refus))) return { ...item, href: projectDeskLink(p.id, "agences"), draft:
      "Bonjour,\n\nJe reviens vers vous au sujet de notre demande " + p.ref +
      ". Pouvez-vous nous indiquer quand vous pourrez nous transmettre votre retour ?\n\nMerci,\nDirection l’Algérie" };
    if (p.statut === "proposee" || (p.premiereReponse && p.manque.length)) return { ...item, href: projectDeskLink(p.id, "voyageur"), draft:
      "Bonjour,\n\nJe reviens vers vous au sujet de votre projet " + p.ref +
      ". Avez-vous pu prendre connaissance de notre dernier message ? Je reste disponible pour avancer avec vous.\n\nDirection l’Algérie" };
    return item;
  });
}

async function radarItems(item: string | undefined, query: string, now: number): Promise<DeskViewItem[]> {
  const radar = await chargerRadar();
  if (!radar.ok) return [];
  const bases = item && estBase(item) ? [item] : ORDRE;
  const wantsSignals = /veille|signal|acteur|partenari|agenda|rendez/.test(query);
  return bases.flatMap(key => radar.bases[key].flatMap(card => {
    const base = BASES[key];
    if (base.masques.includes(card.statut)) return [];
    const value = base.echeance ? card.props[base.echeance] : null;
    const at = typeof value === "string" ? Date.parse(value) : NaN;
    if (!wantsSignals && !(at >= now - 14 * DAY && at <= now + 30 * DAY)) return [];
    return [{
      title: card.titre, tag: base.label,
      href: `/radar/${key}?fiche=${encodeURIComponent(card.id)}`,
      detail: [card.statut, Number.isFinite(at) ? "Échéance le " + fmtD(new Date(at).toISOString()) : null].filter(Boolean).join(" · "),
    }];
  })).slice(0, 10);
}

function groupDuplicates<T>(rows: T[], keys: (row: T) => string[]): T[][] {
  const index = new Map<string, T[]>();
  for (const row of rows) {
    for (const key of new Set(keys(row).filter(Boolean))) index.set(key, [...(index.get(key) ?? []), row]);
  }
  return [...index.values()].filter(group => group.length > 1);
}

const phoneKey = (value: string | null) => {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length >= 8 ? "tel:" + digits : "";
};
const emailKey = (value: string | null) => value?.includes("@") ? "email:" + value.trim().toLowerCase() : "";

async function contactsView(ctx: Bo3Contexte, projects: Projet[], item: string | undefined, query: string): Promise<DeskView> {
  const result = await ctx.supabase.from("contacts").select("id,full_name,type,source_lead_id,email,phone,last_interaction_at")
    .order("last_interaction_at", { ascending: false, nullsFirst: false }).limit(120);
  const contacts = result.data ?? [];
  const contactItem = (c: typeof contacts[number]): DeskViewItem => ({
    title: c.full_name || "Contact", tag: c.type === "traveler" ? "Voyageur" : "Prospect",
    href: "/contacts/" + encodeURIComponent(c.id), detail: c.last_interaction_at ? "Dernier échange le " + fmtD(c.last_interaction_at) : undefined,
  });
  if (item) {
    const { data: contact } = await ctx.supabase.from("contacts").select("id,full_name,type,source_lead_id,last_interaction_at")
      .eq("id", item).maybeSingle();
    if (!contact) return { heading: "Contacts", summary: "Cette fiche contact est indisponible.", items: [] };
    const { data } = await ctx.supabase.from("leads").select("id").eq("contact_id", contact.id).is("deleted_at", null);
    const related = new Set([contact.source_lead_id, ...(data ?? []).map(({ id }) => id)]);
    return { heading: contact.full_name || "Contact", summary: "Dossiers liés à cette fiche dans le Desk.", items: projects.filter(p => related.has(p.id)).map(p => leadItem(p)) };
  }
  if (/doublon|rapproch/.test(query)) {
    const groups = groupDuplicates(contacts, c => [emailKey(c.email), phoneKey(c.phone)]);
    const duplicates = [...new Set(groups.flat())].map(contactItem);
    return { heading: "Contacts à rapprocher", summary: duplicates.length
      ? "Des coordonnées concordent entre ces fiches. Ouvre les fiches pour vérifier le rapprochement."
      : "Aucun doublon par adresse e-mail ou téléphone parmi les contacts consultés.", items: duplicates.slice(0, 15) };
  }
  const names = contacts.filter(c => {
    const n = normalizeDeskQuery(c.full_name ?? "");
    return n && (query.includes(n) || n.split(" ").some(part => part.length > 2 && (" " + query + " ").includes(" " + part + " ")));
  });
  return { heading: "Contacts", summary: names.length ? names.length + " fiche(s) correspondent à ta recherche." : "Indique le nom d’un contact pour retrouver sa fiche et ses dossiers.", items: (names.length ? names : contacts).slice(0, 10).map(contactItem) };
}

async function teamView(ctx: Bo3Contexte, projects: Projet[]): Promise<DeskView> {
  const [members, assignments] = await Promise.all([
    ctx.supabase.from("profiles").select("id,full_name").order("full_name").limit(100),
    ctx.supabase.from("leads").select("id,referent_id").is("deleted_at", null).limit(1000),
  ]);
  const open = new Set(projects.filter(p => p.statut !== "clos").map(p => p.id));
  const counts = new Map<string | null, number>();
  for (const row of assignments.data ?? []) {
    if (open.has(row.id)) counts.set(row.referent_id, (counts.get(row.referent_id) ?? 0) + 1);
  }
  const unassigned = counts.get(null) ?? 0;
  return {
    heading: "Charge de l’équipe", summary: unassigned + " dossier(s) ouvert(s) sans référent dans ton périmètre.",
    items: (members.data ?? []).map(member => ({
      title: member.full_name || "Opérateur", detail: (counts.get(member.id) ?? 0) + " dossier(s) ouvert(s)", href: "/users",
    })),
  };
}

export async function readDeskData(scope: DeskScope, question: string) {
  const data = await donneesBo3();
  if (!data?.ctx.userId || data.ctx.apercu || !["admin", "lead_referent"].includes(data.ctx.role ?? "")) return null;
  const { ctx, projets, agences, now } = data;
  const query = normalizeDeskQuery(question);
  const matches = ["contacts", "agencies", "team", "settings"].includes(scope.screen) ? [] : findDeskProjects(question, projets);
  if (matches.length > 1 && !/compar|ensemble/.test(query)) {
    const view: DeskView = {
      heading: "Choisir un dossier", summary: "Plusieurs dossiers correspondent. Sélectionne celui que tu veux consulter.",
      choices: true, items: matches.map(p => leadItem(p, p.trame?.titre)),
    };
    return { view, projets };
  }
  const project = matches[0] ?? (scope.screen === "project" ? projets.find(p => p.id === scope.leadId) : undefined);
  if (project && matches.length <= 1) {
    const snapshot = await projectEvidence(ctx, project, agences, now);
    if (!snapshot) return null;
    const related = projets.filter(p => p.id !== project.id && ((project.contactId && project.contactId === p.contactId) ||
      (emailKey(project.email) && emailKey(p.email) === emailKey(project.email)) ||
      (phoneKey(project.tel) && phoneKey(p.tel) === phoneKey(project.tel)))).map(p => leadItem(p, p.trame?.titre));
    const mail = isGmailReadRequest(question) ? await readDeskGmail(project.id) : null;
    const view: DeskView = { heading: snapshot.title, summary: snapshot.summary, items: [], project: snapshot, related,
      ...(mail?.ok ? { inbound: mail.messages } : {}) };
    return { view, projets, model: projectPrompt(snapshot) };
  }
  if (scope.screen === "project" && !matches.length) return null;
  const screen = scope.screen === "project" ? "projects" : scope.screen;
  const scopedItem = scope.screen === "project" ? undefined : scope.item;
  const open = projets.filter(p => p.statut !== "clos");
  let view: DeskView;
  if (matches.length > 1) {
    view = { heading: "Comparer les dossiers", summary: "Étapes et prochaines actions des dossiers sélectionnés.", items: matches.map(p => leadItem(p, nextAction(p, agences, now).t)) };
  } else switch (screen) {
    case "file": {
      const relances = /relanc/.test(query);
      const items = fileItems(projets, agences, now, relances);
      const drafts = relances ? items.filter(item => item.draft) : [];
      view = { heading: relances ? "Relances à préparer" : "File de travail", summary: relances
        ? drafts.length + " proposition(s) de relance à relire."
        : open.length + " dossier(s) ouvert(s), classés selon les délais du Desk.", items: relances ? drafts : items };
      break;
    }
    case "projects": {
      const dup = /doublon/.test(query);
      const groups = dup ? groupDuplicates(projets, p => [emailKey(p.email), phoneKey(p.tel)]) : [];
      const picked = dup ? [...new Set(groups.flat())] : projets.filter(p => {
        const search = normalizeDeskQuery([p.trame?.titre, p.trame?.cadre.mois, ...(p.trame?.destinations ?? []).map(d => d.nom), statutLabel(p)].join(" "));
        return query.split(" ").some(term => term.length > 3 && search.split(" ").includes(term));
      });
      view = { heading: dup ? "Doublons possibles" : "Projets", summary: dup ? picked.length + " dossier(s) avec une coordonnée commune."
        : projets.length + " dossier(s) accessibles. Recherche par voyageur, référence, destination, période ou étape.",
      items: (picked.length || dup ? picked : /bloqu/.test(query) ? open.filter(p => p.manque.length || p.statut === "envoye") : projets)
        .slice(0, 15).map(p => leadItem(p, nextAction(p, agences, now).t)) };
      break;
    }
    case "pilot": {
      const won = projets.filter(p => p.issue === "gagne").length;
      const lost = projets.filter(p => p.issue === "perdu").length;
      const counts = new Map<string, number>();
      for (const p of open) counts.set(statutLabel(p), (counts.get(statutLabel(p)) ?? 0) + 1);
      view = { heading: "État du pipeline", summary: "Indicateurs calculés sur les dossiers visibles du Desk.",
        stats: [{ label: "Ouverts", value: String(open.length) }, { label: "Gagnés", value: String(won) }, { label: "Perdus", value: String(lost) },
          { label: "Conversion des dossiers clos", value: won + lost ? Math.round(100 * won / (won + lost)) + " %" : "—" },
          ...[...counts].map(([label, value]) => ({ label, value: String(value) }))],
        items: fileItems(projets, agences, now).slice(0, 5) };
      break;
    }
    case "radar": {
      const alerts = fileItems(projets.filter(p => urgency(p, now) < 24), agences, now).slice(0, 7);
      const expiring = quoteItems(projets.filter(p => p.statut !== "clos" && (quoteDate(p) ?? Infinity) <= now + 7 * DAY), now);
      const quotesOnly = /devis|expir/.test(query);
      const signals = quotesOnly ? [] : await radarItems(scopedItem, query, now);
      view = { heading: "Échéances à surveiller", summary: quotesOnly ? "Devis expirés ou arrivant à échéance dans les sept jours."
        : "Délais de réponse, validité des devis et échéances enregistrées dans le Radar.",
        items: quotesOnly ? expiring : [...alerts, ...expiring, ...signals] };
      break;
    }
    case "agencies": {
      const selected = agences.filter(a => a.id === scopedItem || a.slug === scopedItem);
      const agencies = selected.length ? selected : agences;
      view = { heading: "Réseau d’agences", summary: "Zones couvertes et retours sur les dossiers visibles.",
        items: agencies.slice(0, 20).map(a => {
          const consulted = projets.flatMap(p => p.consultations.filter(c => c.agence === a.id && c.envoye));
          const awaiting = consulted.filter(c => !c.proposition && !c.refus);
          return { title: a.n, href: "/agencies/" + encodeURIComponent(a.id),
            detail: [a.ville, a.zones.map(zone => ZONES[zone]).join(", "), consulted.length + " consultation(s)", awaiting.length + " en attente"].filter(Boolean).join(" · ") };
        }) };
      break;
    }
    case "contacts": view = await contactsView(ctx, projets, scopedItem, query); break;
    case "quotes": {
      const selection = /expir|validit/.test(query) ? projets.filter(p => p.statut !== "clos" && (quoteDate(p) ?? Infinity) <= now + 7 * DAY)
        : /attend/.test(query) ? projets.filter(p => p.statut !== "clos" && p.devis?.envoye) : projets;
      const items = quoteItems(selection, now);
      view = { heading: "Devis voyageurs", summary: items.length + " devis suivi(s) dans les dossiers visibles.", items };
      break;
    }
    case "team": view = await teamView(ctx, projets); break;
    case "settings": view = { heading: "Outils du Desk", summary: "Gère les connexions et les accès depuis les réglages.", items: [
      { title: "DA Sales et Claude", detail: "Connexion et génération de brouillons", href: "/settings" },
      { title: "Gmail du Desk", detail: "Synchronisation des réponses liées aux dossiers", href: "/settings" },
      { title: "Mon profil", href: "/profile" },
    ] }; break;
  }
  return { view, projets, model: screen === "contacts" || screen === "team" || screen === "settings" ? undefined : {
    ecran: DESK_SURFACES[screen].label, constat: view.summary, stats: view.stats,
    lignes: view.items.map(({ reference, detail, tag, title }) => ({ reference, detail, tag, agence: screen === "agencies" ? title : undefined })),
  } };
}

export function cleanDeskText(value: string, projects: Projet[]) {
  return projects.reduce((text, p) => anonymizeAgencyText(text, {
    traveler_name: p.nom, email: p.email ?? undefined, phone: p.tel ?? undefined,
  }), value);
}
