import "server-only";

import { cleanDeskText } from "@/lib/assistant/desk-data";
import { donneesDossiersBo3 } from "@/lib/bo3/donnees";
import { gmailMessageLink, readGmailContent } from "@/lib/email/gmail-intake";
import { deskGmailConfiguration, searchDeskGmail } from "@/lib/email/gmail-sync";
import { anonymizeAgencyText } from "@/lib/email/lead-email-template";

export async function lireBoiteDesk(recherche: unknown, jours: unknown, signal?: AbortSignal) {
  const desk = await donneesDossiersBo3();
  if (!desk?.ctx.userId || desk.ctx.apercu || desk.ctx.role !== "admin") {
    return { erreur: "La recherche dans la boîte partagée est réservée aux administrateurs." };
  }
  if (deskGmailConfiguration() !== "configured") {
    return { erreur: "La boîte Gmail n’est pas connectée dans les Réglages du Desk.", lien: "/settings" };
  }
  const termes = typeof recherche === "string"
    ? recherche.slice(0, 160).match(/[\p{L}\p{N}][\p{L}\p{N}.@_-]*/gu)?.slice(0, 8).join(" ") ?? ""
    : "";
  const periode = typeof jours === "number" && Number.isFinite(jours) ? Math.max(1, Math.min(90, Math.floor(jours))) : 14;
  const { messages, more } = await searchDeskGmail(termes, periode, signal);
  const emails = messages.flatMap(message => {
    if (message.labelIds?.some(label => ["SENT", "DRAFT", "SPAM", "TRASH"].includes(label))) return [];
    const header = (name: string) => message.payload?.headers?.find(h => h.name.toLowerCase() === name)?.value ?? "";
    const sender = header("from");
    const nom = sender.includes("<") ? sender.split("<")[0].trim().replace(/^"|"$/g, "") : "";
    const nettoyer = (text: string) => cleanDeskText(anonymizeAgencyText(text, { traveler_name: nom }), desk.projets);
    const { excerpt, attachments } = readGmailContent(message);
    const received = new Date(Number(message.internalDate));
    return [{
      objet: nettoyer(header("subject")).slice(0, 300),
      recu: Number.isFinite(received.getTime()) ? received.toISOString() : null,
      extrait: nettoyer(excerpt || message.snippet || "").slice(0, 1000),
      pieces: attachments.slice(0, 5).map(name => nettoyer(name).slice(0, 100)),
      lienGmail: message.threadId && /^[a-f0-9]+$/i.test(message.threadId) ? gmailMessageLink(message.threadId) : undefined,
    }];
  });
  return { source: "Boîte Gmail partagée, e-mails entrants", periodeJours: periode, emails, autresResultats: more };
}
