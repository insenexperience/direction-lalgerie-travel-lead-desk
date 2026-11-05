import { readDemandeProjet } from "@/lib/demande-projet-intake";
import { escapeHtml } from "@/lib/email/html";
import { sendTransactionalHtmlEmail, type EmailSendResult } from "@/lib/email/resend-client";

const object = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";

/** One plain mailbox only: never accept a recipient list or header characters from the form. */
export function receiptRecipient(value: unknown): string | null {
  if (typeof value !== "string" || /[\r\n,;<>]/.test(value)) return null;
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function travelerProjectsUrl(): string {
  try {
    const base = new URL(process.env.NEXT_PUBLIC_SITE_BASE_URL?.trim() || "https://www.directionlalgerie.com");
    const localDevelopment = process.env.NODE_ENV !== "production" && base.protocol === "http:"
      && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
    if ((!localDevelopment && base.protocol !== "https:") || base.username || base.password || base.search || base.hash) throw new Error("Invalid site URL");
    return `${base.origin}/mes-voyages`;
  } catch { return "https://www.directionlalgerie.com/mes-voyages"; }
}

/** Explicit projection: credentials, browser proof, contact and internal CRM fields never enter this summary. */
export function buildDemandeEmailSummary(intake: Record<string, unknown>): { text: string; html: string } | null {
  const demande = readDemandeProjet(intake);
  if (!demande) return null;
  const { destination, timing, travelers, wishes } = demande;
  const places = destination.names.length ? destination.names : destination.territories;
  const where = destination.unknown ? "À définir avec votre conseiller"
    : [destination.regionNames.join(" · "), places.join(" · ")].filter(Boolean).join(" — ") || "À préciser";
  const lines = [
    ["Destination", where], ["Quand", timing.label || "À préciser"],
    ["Voyageurs", travelers.label || "À préciser"],
    ...(wishes.styles.length ? [["Manières de voyager", wishes.styles.join(" · ")]] : []),
    ...(wishes.comfort ? [["Confort", wishes.comfort]] : []),
  ];
  const wishesHeading = `Vos envies gardées (${wishes.selection.length})`;
  const wishesText = wishes.selection.length ? wishes.selection.map(wish => `- ${wish.name}`).join("\n") : "Aucune envie ajoutée depuis le guide.";
  const summaryText = [lines.map(([label, value]) => `${label} : ${value}`).join("\n"), `${wishesHeading}\n${wishesText}`,
    wishes.message ? `Votre message\n${wishes.message}` : ""].filter(Boolean).join("\n\n");
  const html = `<table role="presentation" style="border-collapse:collapse;font-size:14px">${lines.map(([label, value]) =>
    `<tr><td style="padding:5px 16px 5px 0;color:#64727a;vertical-align:top">${escapeHtml(label)}</td><td style="padding:5px 0;color:#182b35">${escapeHtml(value)}</td></tr>`).join("")}</table>`
    + `<h2 style="font-size:17px;margin:22px 0 10px">${escapeHtml(wishesHeading)}</h2>`
    + (wishes.selection.length ? `<ul style="padding-left:22px">${wishes.selection.map(wish => `<li>${escapeHtml(wish.name)}</li>`).join("")}</ul>` : `<p>${escapeHtml(wishesText)}</p>`)
    + (wishes.message ? `<h2 style="font-size:17px;margin:22px 0 10px">Votre message</h2><p style="white-space:pre-wrap">${escapeHtml(wishes.message)}</p>` : "");
  return { text: summaryText, html };
}

export type DemandeReceiptEmail = { to: string; subject: string; html: string; text: string; idempotencyKey: string };

/** This is a receipt for a valid website request, not the operator-reviewed welcome/qualification email. */
export function buildDemandeReceiptEmail(input: { leadId: string; intake: Record<string, unknown> }): DemandeReceiptEmail | null {
  const { leadId, intake } = input;
  const trame = object(intake.trame), to = receiptRecipient(intake.email);
  if (!to || !trame || trame.version !== 1 || trame.type !== "demande-projet-voyage"
    || !["ou", "quand", "voyageurs", "envies", "contact", "accord"].every(key => object(trame[key]))
    || object(trame.accord)?.accepte !== true) return null;
  const summary = buildDemandeEmailSummary(intake);
  if (!summary) return null;
  const name = text(intake.full_name);
  const greeting = name ? `Bonjour ${name},` : "Bonjour,";
  const intro = "Nous avons bien reçu votre demande de voyage. Votre conseiller Direction l’Algérie va l’étudier et vous recontacter pour la suite.";
  const local = "Vous pouvez retrouver votre demande et son suivi dans « Mes projets de voyage », depuis le même appareil et le même navigateur que lors de votre envoi.";
  const notice = "Vos choix sont des envies à étudier ensemble. Ce message ne confirme ni un itinéraire, ni un prix, ni une réservation.";
  const link = travelerProjectsUrl();
  const subject = "Direction l’Algérie — Votre demande de voyage est bien reçue";
  return {
    to, subject, idempotencyKey: `intake-receipt-${leadId}`,
    text: [greeting, intro, "Le récapitulatif de votre demande", summary.text, local, link, notice,
      "Vous pouvez répondre à cet email pour compléter votre demande.", "À bientôt,\nL’équipe Direction l’Algérie"].join("\n\n"),
    html: `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f5f6f2;color:#182b35;font:15px/1.7 Arial,sans-serif"><div style="max-width:640px;margin:24px auto;padding:32px;background:#fff"><p style="color:#64727a">Direction l’Algérie</p><h1 style="font:32px/1.2 Georgia,serif;margin:12px 0 24px">Votre demande est bien reçue.</h1><p>${escapeHtml(greeting)}</p><p>${escapeHtml(intro)}</p><h2 style="font-size:19px;margin-top:28px">Le récapitulatif de votre demande</h2>${summary.html}<p style="margin-top:28px">${escapeHtml(local)}</p><p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 18px;background:#182b35;color:#fff;text-decoration:none">Mes projets de voyage</a></p><p style="color:#64727a;font-size:13px">${escapeHtml(notice)}</p><p>Vous pouvez répondre à cet email pour compléter votre demande.</p><p>À bientôt,<br>L’équipe Direction l’Algérie</p></div></body></html>`,
  };
}

export async function envoyerAccuseDemande(input: { leadId: string; intake: Record<string, unknown> }): Promise<EmailSendResult | null> {
  const email = buildDemandeReceiptEmail(input);
  return email ? sendTransactionalHtmlEmail({ ...email, timeoutMs: 5000 }) : null;
}
