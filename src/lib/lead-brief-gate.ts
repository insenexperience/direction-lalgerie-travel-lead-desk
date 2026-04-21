/**
 * Garde-fou "brief exploitable" avant passage Qualification -> Assignation agence.
 * Meme logique cote serveur (actions) et reutilisable pour l'UI (checklist).
 *
 * v2 : quand qualification_blocks est present, la gate se base sur l'etat des 6 blocs.
 * Les helpers v1 (leadBriefChecklist, hasContactChannel) sont conserves pour la checklist UI.
 */

import { allBlocksValidated, BLOCK_IDS, type QualificationBlocks } from "@/lib/qualification-blocks";
import { QUALIFICATION_BLOCKS_CONFIG } from "@/components/leads/qualification/qualification-blocks-config";

export type LeadBriefGateRow = {
  traveler_name?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp_phone_number?: string | null;
  trip_dates?: string | null;
  travelers?: string | null;
  budget?: string | null;
  trip_summary?: string | null;
  travel_style?: string | null;
  qualification_validation_status?: string | null;
  workflow_mode?: string | null;
  qualification_blocks?: QualificationBlocks | null;
};

function t(v: string | null | undefined): string {
  return (v ?? "").trim();
}

export function hasContactChannel(row: LeadBriefGateRow): boolean {
  return t(row.phone).length > 0 || t(row.whatsapp_phone_number).length > 0;
}

export type BriefChecklistItem = { id: string; label: string; ok: boolean };

export function leadBriefChecklist(row: LeadBriefGateRow): BriefChecklistItem[] {
  return [
    { id: "traveler_name", label: "Nom du voyageur", ok: t(row.traveler_name).length > 0 },
    { id: "email", label: "E-mail", ok: t(row.email).length > 0 },
    { id: "phone", label: "Telephone ou WhatsApp", ok: hasContactChannel(row) },
    { id: "trip_dates", label: "Dates / periode", ok: t(row.trip_dates).length > 0 },
    { id: "travelers", label: "Composition du groupe", ok: t(row.travelers).length > 0 },
    { id: "budget", label: "Budget", ok: t(row.budget).length > 0 },
    { id: "trip_summary", label: "Resume du voyage", ok: t(row.trip_summary).length > 0 },
    { id: "travel_style", label: "Style / attentes", ok: t(row.travel_style).length > 0 },
  ];
}

function qualificationSignedOff(row: LeadBriefGateRow): boolean {
  const s = t(row.qualification_validation_status);
  if (s === "validated" || s === "overridden") return true;
  if (row.workflow_mode === "manual" && s !== "rejected") return true;
  return false;
}

export function isLeadBriefExploitable(row: LeadBriefGateRow): boolean {
  // v2 : gate basee sur les 6 blocs structures
  if (row.qualification_blocks) {
    return allBlocksValidated(row.qualification_blocks);
  }
  // v1 fallback : checklist 8 champs + statut global
  const checklist = leadBriefChecklist(row);
  if (!checklist.every((c) => c.ok)) return false;
  if (!qualificationSignedOff(row)) return false;
  return true;
}

/** Message utilisateur si passage vers l'assignation doit etre bloque. */
export function getBriefGateBlockMessage(row: LeadBriefGateRow): string | null {
  // v2 : gate basee sur les 6 blocs structures
  if (row.qualification_blocks) {
    const missing = BLOCK_IDS
      .filter(id => row.qualification_blocks![id].op_action === null)
      .map(id => QUALIFICATION_BLOCKS_CONFIG.find(c => c.id === id)?.label ?? id);
    if (missing.length === 0) return null;
    return `Blocs a valider avant assignation agence : ${missing.join(", ")}.`;
  }
  // v1 fallback
  if (t(row.qualification_validation_status) === "rejected") {
    return "La qualification a ete rejetee : corrigez la fiche ou relancez la qualification avant l'assignation agence.";
  }
  const checklist = leadBriefChecklist(row);
  const missing = checklist.filter((c) => !c.ok);
  if (missing.length > 0) {
    return `Completez la fiche voyageur avant l'assignation (manquant : ${missing.map((m) => m.label).join(", ")}). Utilisez "Modifier la fiche" dans l'encart Dossier.`;
  }
  if (!qualificationSignedOff(row)) {
    return "Validez ou ajustez la qualification (bloc \"Conversation voyageur & IA\") avant de passer a l'assignation agence ou completez la fiche en mode manuel.";
  }
  return null;
}
