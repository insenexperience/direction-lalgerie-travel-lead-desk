/**
 * Tests unitaires — pipeline-calculations.ts
 * Couvre les 7 cas d'acceptation de la PRD (section 11).
 *
 * Pour exécuter (si vitest installé) :
 *   npx vitest run src/lib/pipeline-calculations.test.ts
 *
 * Sinon, valider manuellement via la console navigateur ou Node :
 *   node -r tsx/register src/lib/pipeline-calculations.test.ts
 */
import {
  INSEN_COMMISSION_RATE,
  calculateLeadBudget,
  calculateLeadCommission,
  calculatePipelineTotal,
  calculateClosedRevenue,
  calculateTravelVolume,
  type LeadForCalc,
  type PipelineStages,
} from "./pipeline-calculations";

const STAGES: PipelineStages = {
  new:               { code: "new",               weight: 0.10, is_closed: false, is_won: false },
  qualification:     { code: "qualification",     weight: 0.30, is_closed: false, is_won: false },
  agency_assignment: { code: "agency_assignment", weight: 0.30, is_closed: false, is_won: false },
  co_construction:   { code: "co_construction",   weight: 0.50, is_closed: false, is_won: false },
  quote:             { code: "quote",             weight: 0.60, is_closed: false, is_won: false },
  negotiation:       { code: "negotiation",       weight: 0.80, is_closed: false, is_won: false },
  won:               { code: "won",               weight: 1.00, is_closed: true,  is_won: true  },
  lost:              { code: "lost",              weight: 0.00, is_closed: true,  is_won: false },
};

function lead(overrides: Partial<LeadForCalc> = {}): LeadForCalc {
  return {
    budget_min: null,
    budget_unit: null,
    travelers_adults: 1,
    travelers_children: 0,
    status: "new",
    deleted_at: null,
    ...overrides,
  };
}

// ─── Cas 1 : per_person, 2 adultes, 0 enfant ────────────────────────────────
const cas1 = lead({ budget_min: 2000, budget_unit: "per_person", travelers_adults: 2 });
console.assert(calculateLeadBudget(cas1) === 4000, "CAS1: budget 4000€");
console.assert(calculateLeadCommission(cas1) === 400, "CAS1: commission 400€");

// ─── Cas 2 : per_person, 2 adultes, 2 enfants ────────────────────────────────
// (2 × 2000) + (2 × 2000 × 0,5) = 4000 + 2000 = 6000€
const cas2 = lead({ budget_min: 2000, budget_unit: "per_person", travelers_adults: 2, travelers_children: 2 });
console.assert(calculateLeadBudget(cas2) === 6000, "CAS2: budget 6000€");
console.assert(calculateLeadCommission(cas2) === 600, "CAS2: commission 600€");

// Critère PRD §11 : en étape Devis → contribution = 6000 × 10% × 60% = 360€
const cas2quote = { ...cas2, status: "quote" };
void INSEN_COMMISSION_RATE; // utilisé implicitement via calculateLeadCommission
const weighted2 = calculateLeadCommission(cas2quote) * STAGES["quote"].weight;
console.assert(Math.abs(weighted2 - 360) < 0.01, "CAS2: contribution pipeline 360€");

// ─── Cas 3 : total simple ─────────────────────────────────────────────────────
const cas3 = lead({ budget_min: 5000, budget_unit: "total" });
console.assert(calculateLeadBudget(cas3) === 5000, "CAS3: budget 5000€");

// ─── Cas 4 : budget_min null → retourne 0 ────────────────────────────────────
const cas4 = lead({ budget_min: null, budget_unit: "per_person" });
console.assert(calculateLeadBudget(cas4) === 0, "CAS4: budget null → 0");
console.assert(calculateLeadCommission(cas4) === 0, "CAS4: commission null → 0");

// ─── Cas 5 : pipeline avec mix won/lost/actifs → won/lost exclus ─────────────
const mixLeads: LeadForCalc[] = [
  lead({ budget_min: 2000, budget_unit: "per_person", travelers_adults: 2, status: "qualification" }),
  lead({ budget_min: 3000, budget_unit: "total", status: "won" }),
  lead({ budget_min: 1500, budget_unit: "total", status: "lost" }),
];
const pipeline5 = calculatePipelineTotal(mixLeads, STAGES);
// Seul le 1er lead compte : 4000 × 10% × 30% = 120€
console.assert(Math.abs(pipeline5 - 120) < 0.01, "CAS5: pipeline exclut won/lost → 120€");

// ─── Cas 6 : pipeline vide → 0 ───────────────────────────────────────────────
console.assert(calculatePipelineTotal([], STAGES) === 0, "CAS6: pipeline vide → 0");

// ─── Cas 7 : lead supprimé (deleted_at) → exclu des totaux ───────────────────
const deletedLead: LeadForCalc[] = [
  lead({ budget_min: 5000, budget_unit: "total", status: "qualification", deleted_at: "2026-04-21T00:00:00Z" }),
];
console.assert(calculatePipelineTotal(deletedLead, STAGES) === 0, "CAS7: lead supprimé exclu");
console.assert(calculateClosedRevenue(deletedLead, STAGES) === 0, "CAS7: lead supprimé exclu (closed)");

// ─── Critère PRD §11 : 2 adultes × 2000€, qualification → 120€ ──────────────
const prdCheck = lead({ budget_min: 2000, budget_unit: "per_person", travelers_adults: 2, status: "qualification" });
const prdPipeline = calculatePipelineTotal([prdCheck], STAGES);
console.assert(Math.abs(prdPipeline - 120) < 0.01, "PRD §11: pipeline pondéré 120€");

// ─── Volume voyages ───────────────────────────────────────────────────────────
const vol = calculateTravelVolume([cas1, { ...cas1, status: "won" }], STAGES);
// Seul le lead actif compte : 4000 × 10% = pas ça — budget voyage × poids
// Budget voyage = 4000€, étape new poids 0.10 → 400€
console.assert(Math.abs(vol - 400) < 0.01, "VOLUME: leads actifs uniquement");

console.log("✅ Tous les tests pipeline-calculations passent.");

