import "server-only";
import { readDeskData, cleanDeskText } from "@/lib/assistant/desk-data";
import { parseAssistantEdit, type AssistantEditPreview } from "@/lib/assistant/types";
import { donneesDossiersBo3 } from "@/lib/bo3/donnees";
import type { Proposition } from "./types";

/**
 * Accès de l'agent DA aux dossiers du Desk (DA Sales). Lecture par les mêmes chemins que
 * l'assistant du Desk (droits de la session, contexte sans coordonnées), puis anonymisation
 * des noms, e-mails et téléphones des voyageurs. Écriture : seulement une proposition
 * (note interne ou priorité) que l'opérateur valide ; confirmAssistantEdit revalide tout.
 */

export const ECRANS_DESK = ["file", "projects", "pilot", "radar", "agencies", "quotes"] as const;
const LIMITE_DESK = 24_000;

export async function consulterDesk(question: string, ecran: unknown): Promise<string> {
  const screen = ECRANS_DESK.find((item) => item === ecran) ?? "projects";
  const lu = await readDeskData({ screen }, question.slice(0, 1600));
  if (!lu) return "Erreur : Desk indisponible pour cette session (droits ou chargement).";
  const { view, projets, model } = lu;
  const nettoyer = (texte: string) => cleanDeskText(texte, projets);
  const sortie = {
    titre: nettoyer(view.heading).slice(0, 500),
    constat: nettoyer(view.summary).slice(0, 1200),
    dossiers: view.items.map(({ reference, title, detail, tag }) => ({
      reference: reference === undefined ? undefined : nettoyer(reference),
      titre: nettoyer(title),
      detail: detail === undefined ? undefined : nettoyer(detail),
      etape: tag === undefined ? undefined : nettoyer(tag),
    })),
    dossier: model && (JSON.parse(JSON.stringify(model, (_cle, valeur: unknown) =>
      typeof valeur === "string" ? nettoyer(valeur) : valeur)) as Record<string, unknown>),
    emails: view.inbound?.slice(0, 8).map((m) => ({
      recu: m.received_at,
      type: m.kind,
      objet: nettoyer(m.subject),
      extrait: nettoyer(m.excerpt).slice(0, 1200),
      pieces: m.attachments.map(nettoyer),
    })),
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

type Prep = { ok: true; p: Proposition } | { ok: false; erreur: string };

export async function preparerActionDossier(reference: unknown, action: unknown, valeur: unknown, raison: unknown, seq: () => string): Promise<Prep> {
  const ref = String(reference ?? "").trim().toLowerCase();
  if (!ref) return { ok: false, erreur: "référence de dossier manquante (utilise consulter_desk)." };
  const edit = parseAssistantEdit(action, typeof valeur === "string" ? valeur.trim() : valeur);
  if (!edit || edit.kind === "budget") return { ok: false, erreur: "action invalide : note (texte de 1 à 2000 caractères) ou priority (normal | high)." };
  const data = await donneesDossiersBo3();
  if (!data) return { ok: false, erreur: "Desk indisponible pour cette session." };
  const projet = data.projets.find((p) => p.ref.toLowerCase() === ref);
  if (!projet) return { ok: false, erreur: "dossier introuvable ou hors de tes droits." };
  const { data: lead } = await data.ctx.supabase.from("leads").select("updated_at,priority,referent_id,closed_at,status").eq("id", projet.id).is("deleted_at", null).maybeSingle();
  if (!lead || typeof lead.updated_at !== "string") return { ok: false, erreur: "dossier inaccessible." };
  const admin = data.ctx.role === "admin";
  if (lead.closed_at || lead.status === "won" || lead.status === "lost" || !lead.referent_id || (!admin && lead.referent_id !== data.ctx.userId)) {
    return { ok: false, erreur: "seul le référent du dossier ou un administrateur peut le modifier, et le dossier doit être ouvert et attribué." };
  }
  const nettoyee = edit.kind === "note" ? parseAssistantEdit("note", cleanDeskText(edit.value, data.projets)) : edit;
  if (!nettoyee || nettoyee.kind === "budget") return { ok: false, erreur: "La note anonymisée dépasse 2 000 caractères." };
  const previous = nettoyee.kind === "priority" ? (lead.priority ?? "normal") : null;
  const apercu: AssistantEditPreview = { leadId: projet.id, updatedAt: lead.updated_at, edit: nettoyee, previous };
  const p: Proposition = {
    id: seq(), kind: "dossier", ref: projet.ref, titre: `Dossier ${projet.ref}`, apercu,
    lignes: [nettoyee.kind === "note"
      ? { champ: "Note interne à ajouter", avant: "", apres: nettoyee.value }
      : { champ: "Priorité", avant: previous === "high" ? "haute" : "normale", apres: nettoyee.value === "high" ? "haute" : "normale" }],
    raison: typeof raison === "string" ? cleanDeskText(raison, data.projets).trim().slice(0, 600) || undefined : undefined,
  };
  return { ok: true, p };
}
