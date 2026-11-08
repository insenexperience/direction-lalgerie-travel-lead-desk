export const DESK_MAILBOX = "contact@directionlalgerie.com";

type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string };
  parts?: GmailPart[];
};

export type GmailMessage = {
  threadId?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailPart;
};

export type DeskInboundMail = {
  gmail_id: string;
  gmail_thread_id: string;
  sender: string;
  subject: string;
  received_at: string;
  kind: "agency_proposal" | "agency_reply" | "traveler_reply";
  excerpt: string;
  attachments: string[];
};

export function identifyGmailMessage(message: GmailMessage) {
  if (message.labelIds?.some((label) => ["SENT", "DRAFT", "SPAM", "TRASH"].includes(label))) return null;
  const headers = message.payload?.headers ?? [];
  const get = (name: string) => headers.find((h) => h.name.toLowerCase() === name)?.value ?? "";
  if (/^(?!no\s*$)\S/i.test(get("auto-submitted").trim())) return null;
  const from = get("from").trim();
  const sender = (from.match(/<([^<>]+)>\s*$/)?.[1] ?? from).trim().toLowerCase();
  if (headers.filter((h) => h.name.toLowerCase() === "from").length !== 1 ||
    !/^[a-z0-9.!#$%&'*+/=?^_{}|~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(sender) || sender === DESK_MAILBOX) return null;
  const subject = get("subject").trim();
  const references = new Set(subject.toUpperCase().match(/\bDA-(?:\d{4}-\d{4,}|[A-F0-9]{8})\b(?!-\w)/g));
  if (references.size !== 1 || !message.threadId || !/^[a-f0-9]+$/i.test(message.threadId) ||
    !message.internalDate || !/^\d{1,14}$/.test(message.internalDate)) return null;
  return {
    sender, reference: [...references][0], subject: subject.slice(0, 500),
    receivedAt: new Date(Number(message.internalDate)).toISOString(), threadId: message.threadId,
  };
}

function replyText(text: string) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const boundary = lines.findIndex((line) =>
    /^\s*(?:>|On .+ wrote:\s*$|Le .+ a écrit\s*:\s*$|-{2,}\s*(?:Original Message|Message d'origine|Message transféré))/i.test(line),
  );
  return (boundary === -1 ? lines : lines.slice(0, boundary)).join("\n").replace(/\0/g, "").trim().slice(0, 4000);
}

export function readGmailContent(message: GmailMessage) {
  const texts: string[] = [];
  const files: string[] = [];
  const visit = (part: GmailPart) => {
    if (part.filename) {
      files.push(part.filename.replace(/\0/g, "").slice(0, 200));
      return;
    }
    if (part.mimeType === "text/plain" && part.body?.data) {
      texts.push(replyText(Buffer.from(part.body.data.slice(0, 32000), "base64url").toString("utf8")));
    }
    part.parts?.forEach(visit);
  };
  if (message.payload) visit(message.payload);
  return { excerpt: texts.filter(Boolean).join("\n\n").slice(0, 4000), attachments: [...new Set(files.filter(Boolean))].slice(0, 12) };
}

export function classifyGmailReply(role: "agency" | "traveler", content: ReturnType<typeof readGmailContent>): DeskInboundMail["kind"] {
  if (role === "traveler") return "traveler_reply";
  const offerFile = content.attachments.some((file) =>
    /\.(?:pdf|docx?|xlsx?|odt)$/i.test(file) && /devis|proposition|offre|quotation|quote|chiffrage|tarif/i.test(file));
  const price = /(?:\d[\d .,\u00a0\u202f]{0,16}\s*(?:€|\b(?:EUR|DZD|USD)\b)|(?:€|\b(?:EUR|DZD|USD)\b)\s*\d)/i.test(content.excerpt);
  const offerText = /\b(?:ci-joint|veuillez trouver|voici|please find|attached)\b[^\n]{0,90}\b(?:devis|proposition|offre|quotation|quote|tarif)/i.test(content.excerpt);
  return offerFile || price || offerText ? "agency_proposal" : "agency_reply";
}

export function gmailMessageLink(threadId: string) {
  return "https://mail.google.com/mail/?authuser=" + encodeURIComponent(DESK_MAILBOX) + "#all/" + encodeURIComponent(threadId);
}

export function isGmailReadRequest(message: string) {
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(?:lis|lire|voir|affiche|montre|consulte|recus?|derniers?|nouveaux)\b/.test(normalized) &&
    /\b(?:e-?mails?|mails?|courriels?|reponses? (?:des? |d['’])agences?)\b/.test(normalized) &&
    !/\b(?:envoi|envoie|envoyer|brouillon|redige|rediger|resume|resumer)\b/.test(normalized);
}
