import { readDemandeProjet } from "@/lib/demande-projet-intake";
import { receiptRecipient, travelerProjectsUrl } from "@/lib/email/demande-receipt";
import { escapeHtml } from "@/lib/email/html";
import { travelerProjectTracking, type TravelerProjectTracking } from "@/lib/traveler-project-tracking";

export type ProjectStatusEmailInput = {
  eventId: string;
  leadId: string;
  fullName: string;
  email: string;
  intake: Record<string, unknown>;
  previousStatus: string;
  status: string;
};

export type ProjectStatusEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

const descriptions: Record<TravelerProjectTracking["code"], string> = {
  recue: "Votre demande est bien arrivée chez Direction l’Algérie. Notre équipe va l’étudier.",
  precision: "Notre équipe étudie vos envies et précise avec vous les éléments utiles à votre voyage.",
  preparation: "Notre équipe travaille à construire un voyage adapté à votre projet.",
  proposition: "Notre équipe travaille sur votre proposition et vous contacte pour la suite.",
  discussion: "Vous échangez avec notre équipe pour préciser ou ajuster la proposition.",
  acceptee: "Votre projet est accepté. Notre équipe vous accompagne pour les prochaines démarches ; les réservations restent à confirmer avec elle.",
  cloturee: "Le suivi de cette demande est clôturé. Vous pouvez contacter notre équipe pour en reparler.",
};

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

const uuid = (value: unknown): value is string => typeof value === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Only explicit traveler fields enter this message; no CRM notes, partner details or access credentials. */
export function buildProjectStatusEmail(input: ProjectStatusEmailInput): ProjectStatusEmail | null {
  const { eventId, leadId, intake } = input;
  const to = receiptRecipient(input.email);
  const trame = object(intake.trame);
  if (!to || !uuid(eventId) || !uuid(leadId)
    || !trame || trame.version !== 1 || trame.type !== "demande-projet-voyage"
    || !["ou", "quand", "voyageurs", "envies", "contact", "accord"].every(key => object(trame[key]))
    || object(trame.accord)?.accepte !== true) return null;

  const previous = travelerProjectTracking(input.previousStatus);
  const current = travelerProjectTracking(input.status);
  if (!previous || !current || previous.code === current.code) return null;
  const demande = readDemandeProjet(intake);
  if (!demande) return null;

  const name = input.fullName.trim();
  const greeting = name ? `Bonjour ${name},` : "Bonjour,";
  const reopened = previous.code === "cloturee" && current.code !== "cloturee";
  const intro = reopened ? "Le suivi de votre demande a été rouvert. Voici son état actuel."
    : "Le suivi de votre demande de voyage a été mis à jour.";
  const { destination } = demande;
  const places = destination.names.length ? destination.names : destination.territories;
  const where = destination.unknown ? "À définir avec notre équipe"
    : [destination.regionNames.join(" · "), places.join(" · ")].filter(Boolean).join(" — ");
  const context = where ? `Destination envisagée : ${where}` : "";
  const description = descriptions[current.code];
  const local = "Retrouvez le suivi de votre demande dans « Mes projets de voyage », depuis le même appareil et le même navigateur que lors de votre envoi.";
  const notice = "Ce message ne confirme ni un itinéraire, ni un prix, ni une réservation.";
  const reply = "Vous pouvez répondre à cet email pour échanger avec notre équipe sur la suite de votre projet.";
  const link = travelerProjectsUrl();
  const subject = `Direction l’Algérie — ${current.libelle}`;

  return {
    to, subject, idempotencyKey: `project-status-${eventId.toLowerCase()}`,
    text: [greeting, intro, `État actuel : ${current.libelle}`, description, context, local, link, notice, reply,
      "À bientôt,\nL’équipe Direction l’Algérie"].filter(Boolean).join("\n\n"),
    html: `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f5f6f2;color:#182b35;font:15px/1.7 Arial,sans-serif"><div style="max-width:640px;margin:24px auto;padding:32px;background:#fff"><p style="color:#64727a">Direction l’Algérie</p><h1 style="font:32px/1.2 Georgia,serif;margin:12px 0 24px">${escapeHtml(current.libelle)}</h1><p>${escapeHtml(greeting)}</p><p>${escapeHtml(intro)}</p><p>${escapeHtml(description)}</p>${context ? `<p style="padding:16px;background:#f5f6f2">${escapeHtml(context)}</p>` : ""}<p style="margin-top:28px">${escapeHtml(local)}</p><p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 18px;background:#182b35;color:#fff;text-decoration:none">Mes projets de voyage</a></p><p style="color:#64727a;font-size:13px">${escapeHtml(notice)}</p><p>${escapeHtml(reply)}</p><p>À bientôt,<br>L’équipe Direction l’Algérie</p></div></body></html>`,
  };
}
