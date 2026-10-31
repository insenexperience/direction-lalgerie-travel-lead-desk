import { STATUTS, type Statut } from "./types";

export const MANUAL_STAGE_DB_STATUS = {
  recu: "qualification",
  brief_pret: "agency_assignment",
  envoye: "agency_assignment",
  proposition: "co_construction",
  proposee: "quote",
} as const;
export type ManualStage = keyof typeof MANUAL_STAGE_DB_STATUS;

export const MANUAL_CHANNELS = { whatsapp: "WhatsApp", email: "E-mail", telephone: "Téléphone", autre: "Autre" } as const;
export type ManualChannel = keyof typeof MANUAL_CHANNELS;

export const etapesManuellesSuivantes = (depuis: Statut) =>
  STATUTS.filter((s): s is ManualStage => Object.hasOwn(MANUAL_STAGE_DB_STATUS, s) && STATUTS.indexOf(s) > STATUTS.indexOf(depuis));

/** Un jalon déclaré complète les preuves de l'outil, sans les fabriquer.
 * Les activités sont dans l'ordre chronologique. Une clôture ou un reset reste prioritaire. */
export function etapeAvecAvancementManuel(automatique: Statut, dbStatus: string, activites: Record<string, unknown>[]): Statut {
  let etape = automatique;
  for (const a of activites) {
    if (a.kind === "lead_reset") { etape = automatique; continue; }
    if (a.kind !== "manual_stage_advanced" || !a.payload || typeof a.payload !== "object") continue;
    const payload = a.payload as Record<string, unknown>;
    if (typeof payload.stage !== "string" || !Object.hasOwn(MANUAL_STAGE_DB_STATUS, payload.stage)) continue;
    const stage = payload.stage as ManualStage;
    if (payload.db_status === dbStatus && MANUAL_STAGE_DB_STATUS[stage] === dbStatus && STATUTS.indexOf(stage) > STATUTS.indexOf(etape)) etape = stage;
  }
  return etape;
}
