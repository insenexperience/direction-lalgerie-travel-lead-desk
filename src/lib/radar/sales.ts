import "server-only";
import { readDeskGmail } from "@/app/(dashboard)/leads/gmail-actions";
import { readDeskData, cleanDeskText } from "@/lib/assistant/desk-data";
import { DESK_PROJECT_TABS, projectDeskLink, type DeskScope } from "@/lib/assistant/scope";
import { parseAssistantEdit, type AssistantEditPreview } from "@/lib/assistant/types";
import { donneesDossiersBo3 } from "@/lib/bo3/donnees";
import { nextAction, statutLabel } from "@/lib/bo3/projet";
import { SOURCES, type Projet } from "@/lib/bo3/types";
import type { DeskInboundMail } from "@/lib/email/gmail-intake";
import { formatQualificationBudget, readConfirmedQualificationBudget } from "@/lib/qualification-budget";
import type { Proposition } from "./types";

/**
 * Accès de l'agent DA aux dossiers du Desk (DA Sales). Lecture par les mêmes chemins que
 * l'assistant du Desk (droits de la session, contexte sans coordonnées), puis anonymisation
 * des noms, e-mails et téléphones des voyageurs. Écriture : seulement une proposition
 * (note interne, priorité ou budget) que l'opérateur valide ; confirmAssistantEdit revalide tout.
 */

export const ECRANS_DESK = ["file", "projects", "pilot", "radar", "agencies", "quotes"] as const;
const LIMITE_DESK = 24_000;

const REFERENCE_DOSSIER = /\bDA-(?:\d{4}-\d{4,}|[A-F0-9]{8})\b(?!-\w)/i;

function lienDesk(href: string | undefined) {
  return href && /^\/(?:leads|agencies|radar)\/[a-z0-9_-]+(?:\?(?:tab|fiche)=[a-z0-9_-]+)?$/i.test(href) ? href : undefined;
}

export async function consulterDesk(question: string, ecran: unknown, contexte?: DeskScope): Promise<string> {
  const questionBornee = question.slice(0, 1600);
  const referenceDemandee = questionBornee.match(REFERENCE_DOSSIER)?.[0];
  const ecranDemande = ECRANS_DESK.find((item) => item === ecran);
  const ecranActif = ECRANS_DESK.find((item) => item === contexte?.screen);
  let scope: DeskScope = { screen: ecranDemande ?? "projects" };
  if (contexte?.screen === "project" && !ecranDemande && !referenceDemandee) {
    scope = contexte;
  } else if (ecranActif && ((!ecranDemande && !referenceDemandee) || ecranDemande === ecranActif) && contexte?.screen !== "project") {
    scope = { screen: ecranActif, item: contexte?.item };
  }
  const lu = await readDeskData(scope, questionBornee);
  if (!lu) return "Erreur : Desk indisponible pour cette session (droits ou chargement).";
  const { view, projets, model } = lu;
  if (referenceDemandee && scope.screen !== "agencies" && !dossierCible(projets, referenceDemandee)) {
    return JSON.stringify(dossierIntrouvable);
  }
  const nettoyer = (texte: string) => cleanDeskText(texte, projets);
  const onglet = !ecranDemande && contexte?.screen === "project" && view.project?.id === contexte.leadId
    ? contexte.tab : undefined;
  const sortie = {
    titre: nettoyer(view.project?.ref ?? view.heading).slice(0, 500),
    constat: nettoyer(view.summary).slice(0, 1200),
    lien: view.project ? projectDeskLink(view.project.id, onglet) : undefined,
    onglet: onglet ? DESK_PROJECT_TABS[onglet].label : undefined,
    lienProchaineAction: lienDesk(view.project?.next.href),
    indicateurs: view.stats?.map(({ label, value }) => ({ nom: nettoyer(label), valeur: nettoyer(value) })),
    dossiers: view.items.map(({ reference, title, detail, tag, href }) => ({
      reference: reference === undefined ? undefined : nettoyer(reference),
      titre: nettoyer(reference ?? title),
      detail: detail === undefined ? undefined : nettoyer(detail),
      etape: tag === undefined ? undefined : nettoyer(tag),
      lien: lienDesk(href),
    })),
    dossier: model && (JSON.parse(JSON.stringify(model, (_cle, valeur: unknown) =>
      typeof valeur === "string" ? nettoyer(valeur) : valeur)) as Record<string, unknown>),
    emails: view.inbound?.slice(0, 8).map((m) => formaterEmailDesk(m, nettoyer)),
  };
  const json = JSON.stringify(sortie);
  if (json.length <= LIMITE_DESK) return json;

  const tronque = { ...sortie, tronque: true };
  let extrait = JSON.stringify(tronque);
  // Retire des entrées entières pour conserver un résultat JSON valide.
  for (const lignes of [tronque.emails, tronque.dossiers]) {
    while (extrait.length > LIMITE_DESK && lignes?.length) {
      lignes.pop();
      extrait = JSON.stringify(tronque);
    }
  }
  if (tronque.dossier) {
    for (const cle of Object.keys(tronque.dossier).reverse()) {
      if (extrait.length <= LIMITE_DESK) break;
      delete tronque.dossier[cle];
      extrait = JSON.stringify(tronque);
    }
  }
  return extrait;
}

export async function consulterEntrants(jours: unknown, source: unknown) {
  const data = await donneesDossiersBo3();
  if (!data) return { erreur: "Les demandes entrantes du Desk sont indisponibles." };
  const periode = typeof jours === "number" && Number.isFinite(jours) ? Math.max(1, Math.min(90, Math.floor(jours))) : 7;
  const depuis = new Date(data.now - periode * 86_400_000);
  const correspond = Object.keys(SOURCES).find(key => key === source);
  const projets = data.projets.filter(p => Date.parse(p.recu) >= depuis.getTime() && (!correspond || p.source === correspond));
  const parCanal = Object.entries(SOURCES).map(([id, label]) => ({ canal: label, total: projets.filter(p => p.source === id).length }));
  return {
    source: "Demandes enregistrées dans le CRM du Desk", depuis: depuis.toISOString(), total: projets.length, parCanal,
    dossiers: projets.toSorted((a, b) => Date.parse(b.recu) - Date.parse(a.recu)).slice(0, 20).map(p => ({
      reference: p.ref,
      recu: p.recu,
      canal: SOURCES[p.source],
      etape: statutLabel(p),
      premiereReponse: p.premiereReponse,
      prochaineAction: cleanDeskText(nextAction(p, data.agences, data.now).t, data.projets),
      lien: projectDeskLink(p.id),
    })),
  };
}

function formaterEmailDesk(
  mail: Pick<DeskInboundMail, "received_at" | "kind" | "subject" | "excerpt" | "attachments">,
  nettoyer: (texte: string) => string,
) {
  return {
    recu: mail.received_at,
    type: mail.kind,
    objet: nettoyer(mail.subject),
    extrait: nettoyer(mail.excerpt).slice(0, 1200),
    pieces: mail.attachments.map(nettoyer),
  };
}

function dossierCible(projets: Projet[], reference: unknown, contexte?: DeskScope) {
  const ref = typeof reference === "string" ? reference.trim().toLowerCase() : "";
  if (ref) return projets.find((projet) => projet.ref.toLowerCase() === ref);
  return contexte?.screen === "project" ? projets.find((projet) => projet.id === contexte.leadId) : undefined;
}

const dossierIntrouvable = { ok: false, erreur: "Dossier introuvable ou hors de tes droits. Indique sa référence." } as const;
const deskIndisponible = { ok: false, erreur: "Desk indisponible pour cette session." } as const;

export async function resoudreDossierDesk(reference: unknown, contexte?: DeskScope) {
  const data = await donneesDossiersBo3();
  if (!data) return deskIndisponible;
  const projet = dossierCible(data.projets, reference, contexte);
  return projet ? { ok: true as const, id: projet.id, ref: projet.ref } : dossierIntrouvable;
}

const TYPES_GMAIL_DESK = ["agency_proposal", "agency_reply", "traveler_reply"] as const;

export async function consulterEmailsDesk({
  question, reference, contexte, jours, recherche, type, tousDossiers,
}: {
  question: string;
  reference?: unknown;
  contexte?: DeskScope;
  jours?: unknown;
  recherche?: unknown;
  type?: unknown;
  tousDossiers?: unknown;
}): Promise<string> {
  const data = await donneesDossiersBo3();
  if (!data) return JSON.stringify(deskIndisponible);

  const { ctx, now, projets } = data;
  const referenceDemandee = (typeof reference === "string" && reference.trim()) || question.slice(0, 1600).match(REFERENCE_DOSSIER)?.[0];
  const scope = tousDossiers === true ? undefined : contexte;
  const cible = dossierCible(projets, referenceDemandee, scope);
  if ((referenceDemandee || scope?.screen === "project") && !cible) return JSON.stringify(dossierIntrouvable);

  const fenetre = typeof jours === "number" && Number.isFinite(jours) ? Math.max(1, Math.min(90, Math.trunc(jours))) : undefined;
  const depuis = (nombreJours: number) => new Date(now - nombreJours * 86_400_000).toISOString();
  const dateMin = fenetre ? depuis(fenetre) : cible ? undefined : depuis(30);
  const typeDemande = TYPES_GMAIL_DESK.find((item) => item === type);
  // Ne passe à PostgREST que des mots sans caractères de syntaxe de filtre.
  const termes = typeof recherche === "string" ? recherche.slice(0, 100).match(/[\p{L}\p{N}]{2,}/gu)?.slice(0, 4) ?? [] : [];
  const nettoyer = (texte: string) => cleanDeskText(texte, projets);
  const emails = [];
  if (cible) {
    const resultat = await readDeskGmail(cible.id);
    if (!resultat.ok) return JSON.stringify({ erreur: "Les e-mails synchronisés de ce dossier sont indisponibles pour cette session." });
    const retenus = resultat.messages.filter((mail) => {
      if ((dateMin && Date.parse(mail.received_at) < Date.parse(dateMin)) || (typeDemande && mail.kind !== typeDemande)) return false;
      const texte = (mail.subject + " " + mail.excerpt).toLowerCase();
      return termes.every((terme) => texte.includes(terme.toLowerCase()));
    });
    emails.push(...retenus.slice(0, 8).map((mail) => ({
      ...formaterEmailDesk(mail, nettoyer), reference: nettoyer(cible.ref), lien: projectDeskLink(cible.id, "voyageur"),
    })));
  } else {
    let requete = ctx.supabase.from("desk_gmail_messages").select("lead_id,received_at,kind,subject,excerpt,attachments")
      .gte("received_at", dateMin ?? depuis(30)).order("received_at", { ascending: false }).limit(24);
    if (typeDemande) requete = requete.eq("kind", typeDemande);
    for (const terme of termes) {
      requete = requete.or("subject.ilike.%" + terme + "%,excerpt.ilike.%" + terme + "%");
    }
    type CourrielLie = Pick<DeskInboundMail, "received_at" | "kind" | "subject" | "excerpt" | "attachments"> & { lead_id: string };
    const { data: messages, error } = await requete.returns<CourrielLie[]>();
    if (error) return JSON.stringify({ erreur: "Les e-mails synchronisés du Desk sont indisponibles." });
    const parId = new Map(projets.map((projet) => [projet.id, projet]));
    for (const mail of messages ?? []) {
      const projet = parId.get(mail.lead_id);
      if (!projet) continue;
      emails.push({ ...formaterEmailDesk(mail, nettoyer), reference: nettoyer(projet.ref), lien: projectDeskLink(projet.id, "voyageur") });
      if (emails.length === 8) break;
    }
  }
  const sortie = {
    perimetre: "E-mails reçus, synchronisés et rattachés aux dossiers du Desk accessibles à cette session.",
    reference: cible ? nettoyer(cible.ref) : undefined,
    lien: cible ? projectDeskLink(cible.id, "voyageur") : undefined,
    depuis: dateMin,
    limiteLectureDossier: cible ? 20 : undefined,
    emails,
  };
  let json = JSON.stringify(sortie);
  if (json.length <= LIMITE_DESK) return json;
  while (json.length > LIMITE_DESK && emails.length) {
    emails.pop();
    json = JSON.stringify({ ...sortie, tronque: true });
  }
  return json;
}

type Prep = { ok: true; p: Proposition } | { ok: false; erreur: string };

export async function preparerActionDossier(
  reference: unknown, action: unknown, valeur: unknown, raison: unknown, seq: () => string, contexte?: DeskScope,
): Promise<Prep> {
  const edit = parseAssistantEdit(action, typeof valeur === "string" ? valeur.trim() : valeur);
  if (!edit) return { ok: false, erreur: "Action invalide : note (1 à 2 000 caractères), priority (normal | high) ou budget structuré." };
  const data = await donneesDossiersBo3();
  if (!data) return deskIndisponible;
  const projet = dossierCible(data.projets, reference, contexte);
  if (!projet) return dossierIntrouvable;
  const { data: lead } = await data.ctx.supabase.from("leads")
    .select("updated_at,priority,budget,intake_payload,referent_id,closed_at,status").eq("id", projet.id).is("deleted_at", null).maybeSingle();
  if (!lead || typeof lead.updated_at !== "string") return { ok: false, erreur: "dossier inaccessible." };
  const admin = data.ctx.role === "admin";
  if (lead.closed_at || lead.status === "won" || lead.status === "lost" || !lead.referent_id || (!admin && lead.referent_id !== data.ctx.userId)) {
    return { ok: false, erreur: "seul le référent du dossier ou un administrateur peut le modifier, et le dossier doit être ouvert et attribué." };
  }
  const nettoyee = edit.kind === "note" ? parseAssistantEdit("note", cleanDeskText(edit.value, data.projets)) : edit;
  if (!nettoyee) return { ok: false, erreur: "La note anonymisée dépasse 2 000 caractères." };
  const budgetConfirme = nettoyee.kind === "budget" ? readConfirmedQualificationBudget(lead.intake_payload) : null;
  const previous = nettoyee.kind === "priority" ? (lead.priority ?? "normal")
    : budgetConfirme ? formatQualificationBudget(budgetConfirme)
      : nettoyee.kind === "budget" && typeof lead.budget === "string" ? cleanDeskText(lead.budget, data.projets) : null;
  const apercu: AssistantEditPreview = { leadId: projet.id, updatedAt: lead.updated_at, edit: nettoyee, previous };
  const p: Proposition = {
    id: seq(), kind: "dossier", ref: projet.ref, titre: `Dossier ${projet.ref}`, apercu,
    lignes: [nettoyee.kind === "note"
      ? { champ: "Note interne à ajouter", avant: "", apres: nettoyee.value }
      : nettoyee.kind === "budget"
        ? { champ: "Budget voyageur", avant: previous || "À préciser", apres: formatQualificationBudget(nettoyee.value) + (nettoyee.value.includesFlights === null ? " · Vols à préciser" : "") }
        : { champ: "Priorité", avant: previous === "high" ? "haute" : "normale", apres: nettoyee.value === "high" ? "haute" : "normale" }],
    raison: typeof raison === "string" ? cleanDeskText(raison, data.projets).trim().slice(0, 600) || undefined : undefined,
  };
  return { ok: true, p };
}
