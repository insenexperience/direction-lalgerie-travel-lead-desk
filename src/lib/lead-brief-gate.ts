/**
 * Garde-fou « brief exploitable » avant passage Qualification → Assignation agence.
 * Même logique côté serveur (actions) et réutilisable pour l’UI (checklist).
 */

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
    { id: "phone", label: "Téléphone ou WhatsApp", ok: hasContactChannel(row) },
    { id: "trip_dates", label: "Dates / période", ok: t(row.trip_dates).length > 0 },
    { id: "travelers", label: "Composition du groupe", ok: t(row.travelers).length > 0 },
    { id: "budget", label: "Budget", ok: t(row.budget).length > 0 },
    { id: "trip_summary", label: "Résumé du voyage", ok: t(row.trip_summary).length > 0 },
    { id: "travel_style", label: "Style / attentes", ok: t(row.travel_style).length > 0 },
  ];
}

function qualificationSignedOff(row: LeadBriefGateRow): boolean {
  const s = t(row.qualification_validation_status);
  if (s === "validated" || s === "overridden") return true;
  /** Parcours manuel sans blocage « pending » si la fiche est complète (parité champs). */
  if (row.workflow_mode === "manual" && s !== "rejected") return true;
  return false;
}

export function isLeadBriefExploitable(row: LeadBriefGateRow): boolean {
  const checklist = leadBriefChecklist(row);
  if (!checklist.every((c) => c.ok)) return false;
  if (!qualificationSignedOff(row)) return false;
  return true;
}

/** Message utilisateur si passage vers l’assignation doit être bloqué. */
export function getBriefGateBlockMessage(row: LeadBriefGateRow): string | null {
  if (t(row.qualification_validation_status) === "rejected") {
    return "La qualification a été rejetée : corrigez la fiche ou relancez la qualification avant l’assignation agence.";
  }
  const checklist = leadBriefChecklist(row);
  const missing = checklist.filter((c) => !c.ok);
  if (missing.length > 0) {
    return `Complétez la fiche voyageur avant l’assignation (manquant : ${missing.map((m) => m.label).join(", ")}). Utilisez « Modifier la fiche » dans l’encart Dossier.`;
  }
  if (!qualificationSignedOff(row)) {
    return "Validez ou ajustez la qualification (bloc « Conversation voyageur & IA ») avant de passer à l’assignation agence — ou complétez la fiche en mode manuel.";
  }
  return null;
}
