import { nomAgence, nextAction, statutLabel, type Action } from "@/lib/bo3/projet";
import { SOURCES, STATUT_LABEL, type Agence, type Projet, type Statut } from "@/lib/bo3/types";
import { anonymizeAgencyText } from "@/lib/email/lead-email-template";
import { projectDeskLink, type DeskProjectTab } from "./scope";

export type DeskFact = { label: string; value: string };
export type DeskActivity = { kind: string; created_at: string; payload: unknown };
export type DeskTransition = { to_stage: string; changed_at: string };
type AgencyState = "not_sent" | "declared_waiting" | "waiting" | "all_answered";
type ProjectSource = { title: string; at: string; tab: DeskProjectTab; detail?: string };
type ProjectEvidence = { activities?: DeskActivity[]; transitions?: DeskTransition[]; facts?: DeskFact[]; initial?: DeskFact[];
  qualification?: DeskFact[]; gmailOffers?: number };

const journal: Record<string, { title: string; tab: DeskProjectTab }> = {
  first_response: { title: "Première réponse au voyageur", tab: "voyageur" },
  traveler_link_created: { title: "Lien de qualification créé", tab: "voyageur" },
  qualification_link_issued: { title: "Lien de qualification créé", tab: "voyageur" },
  traveler_link_sent: { title: "Lien de qualification envoyé", tab: "voyageur" },
  traveler_answers: { title: "Réponses du voyageur", tab: "trame" },
  assistant_qualification_saved: { title: "Qualification enregistrée par DA Sales", tab: "trame" },
  trame_updated: { title: "Trame mise à jour", tab: "trame" },
  note_interne: { title: "Note interne ajoutée", tab: "voyageur" },
  internal_note_updated: { title: "Note interne mise à jour", tab: "voyageur" },
  priority_changed: { title: "Priorité modifiée", tab: "trame" },
  referent_changed: { title: "Référent du dossier modifié", tab: "trame" },
  brief_generated: { title: "Brief généré", tab: "agences" },
  brief_edited: { title: "Brief révisé", tab: "agences" },
  brief_sent: { title: "Brief envoyé aux agences", tab: "agences" },
  agency_proposal: { title: "Proposition d’agence enregistrée", tab: "props" },
  quote_converted: { title: "Proposition convertie en devis", tab: "props" },
  quote_sent: { title: "Devis envoyé au voyageur", tab: "props" },
  traveler_reminder: { title: "Relance voyageur enregistrée", tab: "voyageur" },
  project_status_email: { title: "Mise à jour automatique envoyée au voyageur", tab: "voyageur" },
  won: { title: "Projet gagné", tab: "props" },
  lost: { title: "Projet clôturé", tab: "props" },
  lead_reset: { title: "Parcours relancé", tab: "trame" },
};
const emailKind: Record<string, { title: string; tab: DeskProjectTab }> = {
  welcome: { title: "Accusé de réception voyageur", tab: "voyageur" },
  qualification: { title: "E-mail de qualification", tab: "voyageur" },
  agency_feasibility: { title: "Étude de faisabilité agence", tab: "agences" },
  agency_brief: { title: "Brief agence", tab: "agences" },
};
const stageHistory: Record<string, { title: string; tab: DeskProjectTab }> = {
  new: { title: "Dossier reçu", tab: "trame" },
  qualification: { title: "Qualification en cours", tab: "trame" },
  refinement: { title: "Dossier à préciser", tab: "trame" },
  agency_assignment: { title: "Préparation avec les agences", tab: "agences" },
  co_construction: { title: "Échanges avec les agences", tab: "agences" },
  quote: { title: "Préparation de la proposition", tab: "props" },
  negotiation: { title: "Discussion avec le voyageur", tab: "voyageur" },
  won: { title: "Projet gagné", tab: "props" },
  lost: { title: "Projet clôturé", tab: "props" },
};

const payload = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const string = (value: unknown) => typeof value === "string" ? value.trim() : "";
const date = (value: string) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
const when = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Algiers" }).format(new Date(value));

function tabForAction(action: Action): DeskProjectTab {
  if (action === "brief" || action === "scroll-brief" || action === "remind") return "agences";
  if (action === "scroll-prop" || action === "scroll-devis" || action === "proposal") return "props";
  if (action === "first" || action === "ask" || action === "remind-traveler" || action === "close") return "voyageur";
  return "trame";
}

function activitySource(event: DeskActivity, clean: (v: unknown) => string): ProjectSource | null {
  const data = payload(event.payload);
  if (event.kind === "manual_stage_advanced") {
    const stage = string(data.stage) as Statut;
    if (!Object.hasOwn(STATUT_LABEL, stage)) return null;
    return {
      title: stage === "envoye" ? "Envoi du brief déclaré" : "Étape déclarée · " + STATUT_LABEL[stage],
      at: event.created_at, tab: stage === "envoye" || stage === "brief_pret" ? "agences" : "trame",
    };
  }
  if (event.kind === "email_sent" || event.kind === "email_sent_externally") {
    const mail = emailKind[string(data.email_kind)];
    const at = string(data.occurred_at);
    return mail ? { ...mail, title: mail.title + (event.kind === "email_sent_externally" ? " · envoi déclaré" : " · envoyé"), at: date(at) ? at : event.created_at } : null;
  }
  if (event.kind === "external_exchange") {
    return { title: "Échange externe consigné", at: event.created_at, tab: "voyageur" };
  }
  const label = journal[event.kind];
  return label ? { ...label, at: event.created_at, ...(event.kind === "traveler_answers" ? { detail: clean(data.b) } : {}) } : null;
}

export function buildDeskProject(project: Projet, agencies: Agence[], evidence: ProjectEvidence, now: number) {
  const clean = (value: unknown) => anonymizeAgencyText(string(value), {
    traveler_name: project.nom, email: project.email ?? undefined, phone: project.tel ?? undefined,
  }).slice(0, 600);
  const events = [...(evidence.activities ?? [])].filter(a => date(a.created_at)).sort((a, b) => date(a.created_at) - date(b.created_at));
  const current = events.slice(events.findLastIndex(event => event.kind === "lead_reset") + 1);
  const manual = current.findLast(event => event.kind === "manual_stage_advanced" && payload(event.payload).stage === "envoye" &&
    (!payload(event.payload).db_status || payload(event.payload).db_status === project.dbStatus));
  const externalBrief = current.findLast(event => (event.kind === "email_sent" || event.kind === "email_sent_externally") &&
    payload(event.payload).email_kind === "agency_brief");
  const sent = project.consultations.filter(c => Boolean(c.envoye));
  const waiting = sent.filter(c => !c.proposition && !c.refus);
  const offers = sent.flatMap(c => c.proposition ? [{
    id: c.id, agency: nomAgence(agencies, c.agence), at: c.proposition.recu,
    price: c.proposition.prix, days: c.proposition.duree, summary: clean(c.proposition.resume),
    differences: clean(c.proposition.ecarts), selected: c.retenue,
  }] : []);
  const agencyState: AgencyState = waiting.length ? "waiting" : sent.length ? "all_answered"
    : manual || externalBrief || project.statut === "envoye" ? "declared_waiting" : "not_sent";
  const stage = statutLabel(project);
  const action = nextAction(project, agencies, now);
  const declared = manual?.created_at ?? externalBrief?.created_at;
  const waitingNames = waiting.map(c => nomAgence(agencies, c.agence));
  const summary = project.statut === "clos" ? action.t + ". " + action.s : agencyState === "declared_waiting"
    ? "L’envoi du brief aux agences a été déclaré" + (declared ? " le " + when(declared) : "") + ". Les retours restent à suivre. Aucune consultation détaillée n’est rattachée dans le Desk."
    : agencyState === "waiting" ? "Réponse attendue de " + waitingNames.join(", ") + "."
      : agencyState === "all_answered" ? sent.length + " consultation(s) terminée(s), dont " + offers.length + " proposition(s) enregistrée(s)."
        : action.s;
  const recentQualification = current.findLast(event => event.kind === "assistant_qualification_saved");
  const laterTravelerAnswers = current.filter(event => event.kind === "traveler_answers" &&
    (!recentQualification || date(event.created_at) >= date(recentQualification.created_at)));
  const timeline = events.toReversed().flatMap(event => {
    if (event.kind === "qualification_link_issued" && events.some(other => other.kind === "traveler_link_created" &&
        Math.abs(date(event.created_at) - date(other.created_at)) < 5000)) return [];
    const source = activitySource(event, clean);
    return source ? [source] : [];
  });
  for (const consultation of sent) {
    const agency = nomAgence(agencies, consultation.agence);
    timeline.push({ title: "Consultation envoyée · " + agency, at: consultation.envoye, tab: "agences" });
    if (consultation.accuse) timeline.push({ title: "Accusé de réception · " + agency, at: consultation.accuse, tab: "agences" });
    if (consultation.refus) timeline.push({ title: "Consultation déclinée · " + agency, at: consultation.refus, tab: "agences" });
    if (consultation.proposition) timeline.push({ title: "Proposition reçue · " + agency, at: consultation.proposition.recu, tab: "props" });
    for (const at of consultation.relances) timeline.push({ title: "Relance agence · " + agency, at, tab: "agences" });
  }
  for (const transition of evidence.transitions ?? []) {
    if (!Object.hasOwn(stageHistory, transition.to_stage) || !date(transition.changed_at)) continue;
    const stage = stageHistory[transition.to_stage];
    if (!timeline.some(event => event.title === stage.title && Math.abs(date(event.at) - date(transition.changed_at)) < 30000)) {
      timeline.push({ ...stage, at: transition.changed_at });
    }
  }
  if (project.recu && date(project.recu)) timeline.push({ title: "Dossier reçu · " + SOURCES[project.source], at: project.recu, tab: "trame" });
  const cleanFacts = (facts?: DeskFact[]) => (facts ?? []).map(({ label, value }) => ({ label, value: clean(value) })).filter(({ value }) => value);
  const facts = cleanFacts(evidence.facts);
  const initial = cleanFacts(evidence.initial);
  const initialValues = new Map(initial.map(({ label, value }) => [label, value]));
  return {
    id: project.id, ref: project.ref, title: project.nom.includes("@") ? project.ref : project.nom,
    stage, summary, agencyState, sentCount: sent.length, waitingNames,
    next: { label: action.t, detail: action.s, href: projectDeskLink(project.id, tabForAction(action.act)) },
    facts, initial, qualification: cleanFacts(evidence.qualification),
    sinceIntake: facts.filter(({ label, value }) => initialValues.has(label) && initialValues.get(label) !== value)
      .map(({ label, value }) => ({ label, before: initialValues.get(label)!, after: value })),
    timeline: timeline.filter(event => date(event.at)).sort((a, b) => date(b.at) - date(a.at)).slice(0, 15), offers,
    travelerUpdates: laterTravelerAnswers.slice(-4).reverse().map(event => ({ at: event.created_at, detail: clean(payload(event.payload).b) })),
    gmailOffers: evidence.gmailOffers ?? 0,
    quote: project.devis ? {
      price: project.devis.prix, sentAt: project.devis.envoye, createdAt: project.devis.converti,
      validDays: project.devis.validite, id: project.devis.id,
    } : null,
    urgencyHours: waiting.length ? Math.min(...waiting.map(c => (date(c.envoye) + 48 * 3600000 - now) / 3600000)) : null,
  };
}

export type DeskProjectReadout = ReturnType<typeof buildDeskProject>;

export function projectPrompt(project: DeskProjectReadout) {
  return {
    reference: project.ref, etape: project.stage, suivi: project.summary,
    prochaineAction: project.next.label, suiviAgences: project.agencyState,
    consultationsTracees: project.sentCount, retoursAttendus: project.waitingNames,
    demandeInitiale: project.initial, qualificationImportee: project.qualification, faitsActuels: project.facts,
    ecartsDepuisDemandeInitiale: project.sinceIntake, journal: project.timeline.map(({ title, at, detail }) => ({ title, at, detail })),
    derniersRetoursVoyageur: project.travelerUpdates,
    offres: project.offers.map(({ agency, at, price, days, summary, differences, selected }) =>
      ({ agency, at, price, days, summary, differences, selected })),
    gmailPropositionsAVerifier: project.gmailOffers,
    devis: project.quote && {
      prix: project.quote.price, dateCreation: project.quote.createdAt,
      dateEnvoi: project.quote.sentAt, validiteJours: project.quote.validDays,
    },
  };
}
