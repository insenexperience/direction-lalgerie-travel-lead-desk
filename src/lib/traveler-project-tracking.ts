import { createHash, timingSafeEqual } from "node:crypto";

/** A receipt proof belongs to one browser request; a submission id is not an access key. */
export function normalizeTrackingToken(value: unknown): string | null {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value)
    ? value.toLowerCase()
    : null;
}

export function hashTrackingToken(value: unknown): string | null {
  const token = normalizeTrackingToken(value);
  return token ? createHash("sha256").update(token, "utf8").digest("hex") : null;
}

export function verifyTrackingToken(value: unknown, intake: unknown): boolean {
  if (!intake || typeof intake !== "object" || Array.isArray(intake)) return false;
  const expected = (intake as Record<string, unknown>).suivi_token_hash;
  const actual = hashTrackingToken(value);
  if (typeof expected !== "string" || !/^[a-f0-9]{64}$/.test(expected) || !actual) return false;
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

/** Unlike legacy intake, tracking is closed when the server-to-server secret is absent. */
export function verifyTrackingRelaySecret(request: Request): boolean {
  const expected = process.env.INTAKE_SHARED_SECRET?.trim();
  if (!expected) return false;
  const auth = request.headers.get("authorization");
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const dedicated = request.headers.get("x-intake-secret")?.trim() || "";
  const expectedBytes = Buffer.from(expected, "utf8");
  return [bearer, dedicated].some(value => {
    const provided = Buffer.from(value, "utf8");
    return provided.length === expectedBytes.length && timingSafeEqual(provided, expectedBytes);
  });
}

export type TravelerProjectTracking = {
  code: "recue" | "precision" | "preparation" | "proposition" | "discussion" | "acceptee" | "cloturee";
  libelle: string;
  description: string;
  etape: number;
  termine: boolean;
  verifieLe: string;
};

type TrackingStep = Omit<TravelerProjectTracking, "verifieLe">;

const RECEIVED: TrackingStep = {
  code: "recue", libelle: "Demande reçue", etape: 0, termine: false,
  description: "Votre demande est bien arrivée chez Direction l’Algérie. Un conseiller va l’étudier.",
};
const QUALIFICATION: TrackingStep = {
  code: "precision", libelle: "Étude de votre demande", etape: 1, termine: false,
  description: "Votre conseiller étudie vos envies et précise avec vous les éléments utiles à votre voyage.",
};
const PREPARATION: TrackingStep = {
  code: "preparation", libelle: "Voyage en préparation", etape: 2, termine: false,
  description: "Votre conseiller travaille à construire un voyage adapté à votre projet.",
};
const STEPS: Record<string, TrackingStep> = {
  new: RECEIVED,
  qualification: QUALIFICATION,
  refinement: QUALIFICATION,
  agency_assignment: PREPARATION,
  co_construction: PREPARATION,
  quote: {
    code: "proposition", libelle: "Proposition en cours", etape: 3, termine: false,
    description: "Votre conseiller travaille sur votre proposition et vous contacte pour la suite.",
  },
  negotiation: {
    code: "discussion", libelle: "Proposition en discussion", etape: 4, termine: false,
    description: "Vous échangez avec votre conseiller pour préciser ou ajuster la proposition.",
  },
  won: {
    code: "acceptee", libelle: "Projet accepté", etape: 5, termine: true,
    description: "Votre projet est accepté. Votre conseiller vous accompagne pour les prochaines démarches ; les réservations restent à confirmer avec lui.",
  },
  lost: {
    code: "cloturee", libelle: "Demande clôturée", etape: 0, termine: true,
    description: "Le suivi de cette demande est clôturé. Vous pouvez contacter votre conseiller pour en reparler.",
  },
};

/** Only this allowlist crosses the traveler boundary: no CRM notes, partner, price or contact. */
export function travelerProjectTracking(status: unknown, now = new Date()): TravelerProjectTracking | null {
  if (typeof status !== "string" || !Object.hasOwn(STEPS, status)) return null;
  return { ...STEPS[status], verifieLe: now.toISOString() };
}
