import { isUuid } from "@/lib/is-uuid";

export const DESK_SURFACES = {
  file: { label: "File de travail", href: "/inbox", prompts: ["Qu’est-ce que je traite aujourd’hui ?", "Prépare les relances prioritaires"] },
  projects: { label: "Projets", href: "/leads", prompts: ["Quels dossiers sont bloqués ?", "Repère les doublons possibles"] },
  pilot: { label: "Pilotage", href: "/dashboard", prompts: ["Explique l’état du pipeline", "Prépare le point d’équipe"] },
  radar: { label: "Radar", href: "/radar", prompts: ["Quelles échéances faut-il surveiller ?", "Quels devis expirent bientôt ?"] },
  agencies: { label: "Agences", href: "/agencies", prompts: ["Compare les agences par zone", "Quelles agences ont des réponses en attente ?"] },
  contacts: { label: "Contacts", href: "/contacts", prompts: ["Retrouve un voyageur et ses dossiers", "Repère les contacts à rapprocher"] },
  quotes: { label: "Devis", href: "/quotes", prompts: ["Quels devis attendent une réponse ?", "Quels devis expirent bientôt ?"] },
  team: { label: "Équipe", href: "/users", prompts: ["Comment sont répartis les dossiers ?", "Quels dossiers restent à attribuer ?"] },
  settings: { label: "Réglages", href: "/settings", prompts: ["Quels outils sont disponibles ?"] },
} as const;

export const DESK_PROJECT_TABS = {
  trame: { label: "Trame", prompts: ["Où en est ce dossier ?", "Qu’est-ce qui a changé depuis la qualification ?", "Quels points restent à préciser ?"] },
  agences: { label: "Brief & agences", prompts: ["Quelles agences ont été contactées ?", "Quelles réponses attendons-nous ?", "Propose une relance agence"] },
  props: { label: "Propositions & devis", prompts: ["Compare les offres reçues", "Le devis a-t-il été envoyé ?", "Prépare une réponse au voyageur"] },
  voyageur: { label: "Voyageur & messages", prompts: ["Résume les échanges du dossier", "Lis les derniers e-mails du dossier", "Quels sont les derniers retours ?"] },
} as const;

export const DESK_PROJECT_TAB_EVENT = "desk:project-tab";
export type DeskProjectTab = keyof typeof DESK_PROJECT_TABS;
export type DeskSurface = keyof typeof DESK_SURFACES;
export type DeskScope = { screen: "project"; leadId: string; tab: DeskProjectTab } | { screen: DeskSurface; item?: string };

export function isDeskTab(value: unknown): value is DeskProjectTab {
  return typeof value === "string" && Object.hasOwn(DESK_PROJECT_TABS, value);
}

export function isDeskScope(input: unknown): input is DeskScope {
  if (!input || typeof input !== "object" || !("screen" in input) || typeof input.screen !== "string") return false;
  if (input.screen === "project") {
    return "leadId" in input && typeof input.leadId === "string" && isUuid(input.leadId) && "tab" in input && isDeskTab(input.tab);
  }
  return Object.hasOwn(DESK_SURFACES, input.screen) && (!("item" in input) || input.item === undefined ||
    (typeof input.item === "string" && /^[a-z0-9_-]{1,100}$/i.test(input.item)));
}

export function deskScopeForPath(path: string): Exclude<DeskScope, { screen: "project" }> {
  const [, route, item] = path.split("/");
  switch (route) {
    case "leads": return { screen: "projects" };
    case "dashboard":
    case "metrics": return { screen: "pilot" };
    case "radar": return { screen: "radar", item };
    case "agencies": return { screen: "agencies", item };
    case "contacts": return { screen: "contacts", item };
    case "quotes": return { screen: "quotes" };
    case "users": return { screen: "team" };
    case "profile":
    case "settings": return { screen: "settings" };
    default: return { screen: "file" };
  }
}

export function projectDeskLink(id: string, tab?: DeskProjectTab) {
  return "/leads/" + encodeURIComponent(id) + (tab ? "?tab=" + tab : "");
}

export function normalizeDeskQuery(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

type Searchable = { id: string; ref: string; nom: string };

export function findDeskProjects<T extends Searchable>(question: string, projects: T[]): T[] {
  const text = " " + normalizeDeskQuery(question) + " ";
  const references = projects.filter((p) => p.ref && text.includes(" " + normalizeDeskQuery(p.ref) + " "));
  if (references.length) return references;
  const matches = projects.filter((p) => p.nom && !p.nom.includes("@") && normalizeDeskQuery(p.nom) !== "voyageur");
  const full = matches.filter((p) => normalizeDeskQuery(p.nom).includes(" ") && text.includes(" " + normalizeDeskQuery(p.nom) + " "));
  const remainder = full.reduce((result, p) => result.replace(" " + normalizeDeskQuery(p.nom) + " ", " "), text);
  const partial = matches.filter((p) => {
    const parts = normalizeDeskQuery(p.nom).split(" ");
    return [parts[0], parts.at(-1)!].some(name => name.length >= 3 && remainder.includes(" " + name + " "));
  });
  return [...new Map([...full, ...partial].map(p => [p.id, p])).values()];
}
