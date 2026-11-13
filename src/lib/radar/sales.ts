import "server-only";
import { readDeskData, cleanDeskText } from "@/lib/assistant/desk-data";
import { DESK_SURFACES, type DeskSurface } from "@/lib/assistant/scope";
import { parseAssistantEdit, type AssistantEditPreview } from "@/lib/assistant/types";
import { donneesDossiersBo3 } from "@/lib/bo3/donnees";
import type { Proposition } from "./types";

/**
 * Accès de l'agent DA aux dossiers du Desk (DA Sales). Lecture par les mêmes chemins que
 * l'assistant du Desk (droits de la session, contexte sans coordonnées), puis anonymisation
 * des noms, e-mails et téléphones des voyageurs. Écriture : seulement une proposition
 * (note interne ou priorité) que l'opérateur valide ; confirmAssistantEdit revalide tout.
 */

const ECRANS = Object.keys(DESK_SURFACES).filter((k) => !["contacts", "team", "settings"].includes(k)) as DeskSurface[];
export const ECRANS_DESK = ECRANS;

export async function consulterDesk(question: string, ecran: unknown): Promise<string> {
  const screen: DeskSurface = ECRANS.includes(ecran as DeskSurface) ? (ecran as DeskSurface) : "projects";
  const lu = await readDeskData({ screen }, question.slice(0, 1600));
  if (!lu) return "Erreur : Desk indisponible pour cette session (droits ou chargement).";
  const { view, projets, model } = lu;
  const sortie = {
    titre: view.heading,
    constat: view.summary,
    dossiers: view.items.map(({ reference, title, detail, tag }) => ({ reference, titre: title, detail, etape: tag })),
    dossier: model,
    emails: view.inbound?.slice(0, 8).map((m) => ({ recu: m.received_at, type: m.kind, objet: m.subject, extrait: m.excerpt.slice(0, 1200), pieces: m.attachments })),
  };
  return cleanDeskText(JSON.stringify(sortie), projets).slice(0, 24_000);
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
  const previous = edit.kind === "priority" ? (lead.priority ?? "normal") : null;
  const apercu: AssistantEditPreview = { leadId: projet.id, updatedAt: lead.updated_at, edit, previous };
  const texte = edit.kind === "note" ? cleanDeskText(edit.value, data.projets) : edit.value;
  const p: Proposition = {
    id: seq(), kind: "dossier", ref: projet.ref, titre: `Dossier ${projet.ref}`, apercu,
    lignes: [edit.kind === "note"
      ? { champ: "Note interne (ajoutée)", avant: "", apres: texte }
      : { champ: "Priorité", avant: previous === "high" ? "haute" : "normale", apres: edit.value === "high" ? "haute" : "normale" }],
    raison: raison ? String(raison).slice(0, 600) : undefined,
  };
  return { ok: true, p };
}
