import { DIRECTION_ALG_LOGO_URL } from "@/lib/brand-assets";
import { escapeHtml } from "@/lib/email/html";
import { analyzeLeadQualification, type LeadQualificationInput, type QualificationChecklistItem } from "@/lib/lead-qualification-completeness";

export type LeadEmailKind = "welcome" | "qualification" | "agency_feasibility" | "agency_brief";
export type AgencyEmailKind = "agency_feasibility" | "agency_brief";

export function isAgencyEmailKind(kind: unknown): kind is AgencyEmailKind {
  return kind === "agency_feasibility" || kind === "agency_brief";
}
export type LeadEmailLanguage = "fr" | "en";
export type LeadEmailTemplateInput = LeadQualificationInput & {
  id?: string;
  reference?: string | null;
  traveler_name?: string;
  email?: string;
  phone?: string;
  generated_brief?: string | null;
  ai_qualification_payload?: unknown;
  preferred_language?: string | null;
};

export const LEAD_EMAIL_TEMPLATE_VERSION = "direction-algerie-2026-10-v2";
const CONTACT = "contact@directionlalgerie.com";
const SITE = "https://www.directionlalgerie.com";

function recordedLanguage(lead: LeadEmailTemplateInput): LeadEmailLanguage {
  const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const intake = object(lead.intake_payload);
  const ai = object(lead.ai_qualification_payload);
  const candidates = [lead.preferred_language, object(intake.manual_import).language, intake.language, object(ai.manual_import).language, ai.language];
  return candidates.find((value) => value === "en" || value === "fr") as LeadEmailLanguage | undefined ?? "fr";
}

/** Keep personal identity out of agency previews, copied messages and dispatch. */
export function anonymizeAgencyText(text: string, lead: LeadEmailTemplateInput): string {
  let safe = text;
  const identities = [lead.traveler_name, lead.email, lead.phone].filter(Boolean) as string[];
  if (lead.traveler_name) identities.push(...lead.traveler_name.split(/\s+/).filter((part) => part.length > 3));
  for (const value of identities.sort((a, b) => b.length - a.length)) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    safe = safe.replace(new RegExp(escaped, "gi"), "[voyageur]");
  }
  safe = safe.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email masqué]");
  // Only recognizable telephone formats; do not mask dates, distances or budgets.
  safe = safe.replace(/(?:\+\d{1,3}[\s.-]?(?:\d[\s.-]?){8,12}|\b0[1-9](?:[\s.-]?\d){8}\b)/g, "[téléphone masqué]");
  safe = safe.replace(/((?:instagram|tiktok|facebook|linkedin|réseaux? sociaux?|social (?:profile|media))[^\n@]*)(@[\w.-]+)/gi, "$1[profil masqué]");
  safe = safe.replace(/https?:\/\/(?:www\.)?(?:instagram\.com|tiktok\.com|facebook\.com|linkedin\.com)\/[^\s]+/gi, "[profil masqué]");
  return safe;
}

/** The reformatted traveler message stays part of the agency brief, not just its short recap. */
export function agencyTravelNotes(lead: LeadEmailTemplateInput): string {
  const intake = lead.intake_payload && typeof lead.intake_payload === "object" && !Array.isArray(lead.intake_payload)
    ? lead.intake_payload as Record<string, unknown> : {};
  const notes = [lead.project_description, intake.notes_longues]
    .find((value): value is string => typeof value === "string" && Boolean(value.trim()));
  return notes ? anonymizeAgencyText(notes.trim(), lead) : "";
}

function feasibilityChecklistValue(item: QualificationChecklistItem): string {
  const value = item.value || "";
  if (item.id === "flights") return ({ include: "Vols à inclure", self_managed: "Vols réservés par le voyageur", already_booked: "Vols déjà réservés", none: "Aucun vol nécessaire" } as Record<string, string>)[value] || value;
  if (item.id === "budget_scope") return ({ "flights included": "Vols inclus", "flights excluded": "Hors vols" } as Record<string, string>)[value] || value;
  if (item.id === "budget") return value.replace(/\bper_person\b/g, "par personne").replace(/\btotal$/, "au total");
  if (item.id === "children_ages" && /^\d+(?:,\s*\d+)*$/.test(value)) return `${value} ans`;
  return value;
}

function firstName(fullName: string | undefined): string {
  return fullName?.trim().split(/\s+/)[0] ?? "";
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 24px;color:#101e26;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.9;">${text}</p>`;
}

/** Editable text is escaped, never treated as operator-provided HTML. */
function renderBody(text: string): string {
  return text.trim().split(/\n\s*\n/).map((block) => {
    const lines = block.split("\n");
    const bullets = lines.every((line) => /^\s*(?:[•*-]|\d+[.)])\s+/.test(line));
    if (bullets) {
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">${lines.map((line) => `<tr><td valign="top" style="width:24px;padding:0 8px 18px 0;color:#92600e;font-size:17px;line-height:1.8;">&bull;</td><td valign="top" style="padding:0 0 18px;color:#101e26;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.85;">${escapeHtml(line.replace(/^\s*(?:[•*-]|\d+[.)])\s+/, ""))}</td></tr>`).join("")}</table>`;
    }
    return paragraph(escapeHtml(block).replace(/\n/g, "<br>"));
  }).join("");
}

export function renderLeadEmailHtml(input: {
  kind: LeadEmailKind;
  language: LeadEmailLanguage;
  bodyText: string;
  travelerName?: string;
  reference?: string | null;
  whatsappHref?: string;
  mailtoHref?: string;
}): string {
  const english = input.language === "en";
  const agency = isAgencyEmailKind(input.kind);
  const feasibility = input.kind === "agency_feasibility";
  const name = firstName(input.travelerName);
  const title = feasibility ? "Un premier parcours à imaginer." : agency ? "Un projet à construire ensemble." : input.kind === "welcome"
    ? `${english ? "Welcome" : "Bienvenue"}${name ? `, ${name}` : ""}.`
    : english ? "Let’s shape your journey." : "Donnons forme à votre voyage.";
  const subtitle = feasibility ? `Étude de faisabilité non chiffrée · ${input.reference || "Direction l’Algérie"}` : agency ? `Brief agence · ${input.reference || "Direction l’Algérie"}` : english
    ? "Your travel project is in good hands." : "Votre projet de voyage est bien arrivé.";
  const mailto = input.mailtoHref?.startsWith("mailto:") ? input.mailtoHref : `mailto:${CONTACT}`;
  const whatsapp = input.whatsappHref && /^https:\/\/wa\.me\/\d{8,15}(?:\?|$)/.test(input.whatsappHref) ? input.whatsappHref : null;
  const cta = agency ? "" : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 20px;"><tr><td bgcolor="#f6a72d" style="background:#f6a72d;"><a href="${escapeHtml(mailto)}" style="display:inline-block;padding:16px 24px;color:#101e26;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;text-decoration:none;">${english ? "Contact our team" : "Écrire à notre équipe"}</a></td></tr></table>${whatsapp ? paragraph(`<a href="${escapeHtml(whatsapp)}" style="color:#132e3d;">${english ? "Continue on WhatsApp" : "Poursuivre sur WhatsApp"}</a>`) : ""}`;
  return `<!DOCTYPE html><html lang="${input.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>@media screen and (max-width:540px){.email-pad{padding-left:24px!important;padding-right:24px!important}.welcome-title{font-size:34px!important}}</style></head><body style="margin:0;padding:0;background:#f5f6f2;"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(subtitle)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f6f2"><tr><td align="center" style="padding:32px 12px;"><!--[if mso]><table width="640"><tr><td><![endif]--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:640px;background:#ffffff;"><tr><td align="center" bgcolor="#0d2431" style="padding:34px 24px;"><a href="${SITE}"><img src="${escapeHtml(DIRECTION_ALG_LOGO_URL)}" width="176" height="80" alt="Direction l’Algérie" style="display:block;width:176px;height:80px;border:0;"></a></td></tr><tr><td class="email-pad" bgcolor="#f5f6f2" style="padding:40px 40px 38px;"><table role="presentation" width="36" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td height="3" bgcolor="#f6a72d" style="font-size:0;line-height:0;">&nbsp;</td></tr></table><h1 class="welcome-title" style="margin:0 0 16px;color:#132e3d;font-family:Cormorant,Georgia,Times,serif;font-size:${agency ? 34 : 42}px;font-weight:normal;line-height:1.12;letter-spacing:-.7px;">${escapeHtml(title)}</h1><p style="margin:0;color:#64727a;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:14px;line-height:1.8;">${escapeHtml(subtitle)}</p></td></tr><tr><td class="email-pad" style="padding:38px 40px 14px;">${renderBody(input.bodyText)}${cta}</td></tr><tr><td class="email-pad" style="padding:26px 40px 32px;border-top:1px solid #d5dcdd;">${paragraph(english ? "Your point of contact in Algeria." : "Votre interlocuteur pour un voyage en Algérie.")}<a href="mailto:${CONTACT}" style="color:#132e3d;font:12px/1.8 Arial,sans-serif;">${CONTACT}</a><br><a href="${SITE}" style="color:#64727a;font:12px/1.8 Arial,sans-serif;text-decoration:none;">directionlalgerie.com</a></td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}

export function buildLeadEmailTemplate(lead: LeadEmailTemplateInput, kind: LeadEmailKind, options: {
  language?: LeadEmailLanguage;
  bodyText?: string;
} = {}) {
  const agency = isAgencyEmailKind(kind);
  const analysis = analyzeLeadQualification(lead, { language: agency ? "fr" : options.language ?? recordedLanguage(lead) });
  const language = agency ? "fr" : analysis.language;
  const english = language === "en";
  const ref = lead.reference || (lead.id ? `DA-${lead.id.slice(0, 8).toUpperCase()}` : "Dossier à qualifier");
  const questionText = analysis.questions.map((question) => `• ${question.label} : ${question.question}`).join("\n\n");
  const recap = [
    [english ? "Project" : "Projet", lead.trip_summary],
    [english ? "Travel dates" : "Période", lead.trip_dates],
    [english ? "Travel party" : "Groupe", lead.travelers],
    [english ? "Travel style" : "Style", lead.travel_style],
    [english ? "Budget" : "Budget", lead.budget],
  ].filter(([, value]) => typeof value === "string" && value.trim()).map(([label, value]) => `${label} : ${value}`).join("\n");
  const subject = kind === "agency_feasibility" ? anonymizeAgencyText(`Direction l’Algérie — Étude de faisabilité non chiffrée ${ref}`, lead) : kind === "agency_brief" ? `Direction l’Algérie — Brief agence ${ref}` : kind === "welcome"
    ? english ? "Direction l’Algérie — We have received your travel enquiry" : "Direction l’Algérie — Votre projet de voyage est bien arrivé"
    : english ? "Direction l’Algérie — A few details for your travel project" : "Direction l’Algérie — Quelques précisions pour votre voyage";
  let bodyText: string;
  if (kind === "agency_feasibility") {
    // A generated sales brief can ask for prices or promise a response in 48 h.
    // Start this earlier study from the traveler facts and source notes instead.
    const intake = lead.intake_payload && typeof lead.intake_payload === "object" && !Array.isArray(lead.intake_payload)
      ? lead.intake_payload as Record<string, unknown> : {};
    const notes = agencyTravelNotes(lead) || (typeof intake.source_message === "string" ? anonymizeAgencyText(intake.source_message.trim(), lead) : "");
    const confirmed = analysis.checklist.filter((item) => item.status === "complete" && item.value && !(item.id === "itinerary" && anonymizeAgencyText(item.value.trim(), lead) === notes));
    const project = [
      ["Projet", lead.trip_summary], ["Destinations envisagées", lead.destination_main], ["Style souhaité", lead.travel_style],
    ].filter(([, value]) => typeof value === "string" && value.trim()).map(([label, value]) => `${label} : ${value}`).join("\n");
    bodyText = anonymizeAgencyText([
      "Bonjour,",
      `Nous sollicitons votre expertise locale pour une première étude de faisabilité non chiffrée du dossier ${ref}, et pour imaginer un parcours adapté. Direction l’Algérie reste l’interlocuteur du voyageur.`,
      "À ce stade, nous attendons un avis de terrain et une première intention de parcours. Le chiffrage sera demandé dans un second temps, après validation du parcours et de ses conditions de réalisation. Un budget éventuellement communiqué ci-dessous sert uniquement de contrainte de conception ; aucune offre tarifaire n’est attendue pour cette étude.",
      project ? `Projet envisagé — à étudier :\n${project}` : "Le projet est décrit dans la demande détaillée ci-dessous ; les éléments non précisés restent à confirmer.",
      notes ? `Demande détaillée du voyageur — retranscription anonymisée :\n${notes}` : "Aucune demande détaillée complémentaire n’a été renseignée à ce stade.",
      confirmed.length ? `Précisions confirmées dans le dossier :\n${confirmed.map((item) => `• ${item.label} : ${feasibilityChecklistValue(item)}`).join("\n")}` : "Aucune précision de qualification supplémentaire n’est confirmée à ce stade.",
      analysis.questions.length ? `Informations inconnues ou restant à confirmer — ne pas les considérer comme acquises :\n${analysis.questions.map((question) => `• ${question.label} : à confirmer`).join("\n")}` : "",
      "Pour ce premier retour, pourriez-vous nous proposer :\n• Un avis sur la faisabilité du projet sur le terrain, en distinguant ce qui est possible, ce qui nécessite une adaptation et ce qui paraît impossible.\n• Une première idée de parcours : étapes, ordre des visites, durée conseillée, trajets et temps de déplacement estimés, ainsi qu’un rythme adapté.\n• Les contraintes de saison, d’accès et d’autorisations, ainsi que les conditions logistiques nécessaires : accompagnement, transports et hébergements selon le projet.\n• Des alternatives concrètes si certaines destinations, étapes ou modalités ne peuvent pas être réalisées.\n• Les points à clarifier avec le voyageur et les hypothèses qui restent à valider avant d’arrêter le parcours.",
      analysis.expedition ? "Pour ce projet d’expédition, merci d’examiner particulièrement le format en autonomie, les obligations de guidage ou d’escorte, les accès et autorisations, la disponibilité et la fiabilité de l’eau, les besoins de portage ou de ravitaillement, les conditions de bivouac et les solutions de repli. Les itinéraires, distances et stratégies d’eau évoqués par le voyageur sont des pistes à vérifier, sans confirmation à ce stade." : "",
      "Merci de nous indiquer le délai nécessaire pour nous transmettre ce premier avis et votre suggestion de parcours. Si des informations sont indispensables pour commencer l’étude, précisez-les dans votre retour.",
      "Pour toute question, merci de répondre à Direction l’Algérie. Les échanges et coordonnées du voyageur restent gérés par notre équipe.",
      "Bien cordialement,\nDirection l’Algérie",
    ].filter(Boolean).join("\n\n"), lead);
  } else if (kind === "agency_brief") {
    const brief = anonymizeAgencyText(lead.generated_brief?.trim() || recap || "Le projet doit être qualifié dans le dossier.", lead);
    const notes = agencyTravelNotes(lead);
    bodyText = anonymizeAgencyText([
      "Bonjour,",
      `Nous vous transmettons le dossier ${ref} pour préparer une proposition adaptée. Direction l’Algérie reste l’interlocuteur du voyageur.`,
      brief,
      notes && !brief.includes(notes) ? `Demande détaillée du voyageur — retranscription :\n${notes}` : "",
      analysis.checklist.some((item) => item.status === "complete" && item.value)
        ? `Précisions confirmées dans le dossier :\n${analysis.checklist.filter((item) => item.status === "complete" && item.value).map((item) => `• ${item.label} : ${item.value}`).join("\n")}` : "",
      analysis.questions.length ? `Points restant à confirmer (ne pas les considérer comme acquis) :\n${analysis.questions.map((question) => `• ${question.label}`).join("\n")}` : "",
      analysis.expedition ? "Merci de distinguer la faisabilité, les autorisations et conditions obligatoires, la logistique, les adaptations nécessaires et les coûts. Aucun itinéraire ni format d’expédition n’est confirmé à ce stade." : "Merci de détailler votre itinéraire, les prestations, le prix, les inclusions et exclusions, ainsi que les hypothèses et disponibilités à confirmer.",
      "Pour toute question, merci de répondre à Direction l’Algérie. Les échanges et coordonnées du voyageur restent gérés par notre équipe.",
      "Bien cordialement,\nDirection l’Algérie",
    ].filter(Boolean).join("\n\n"), lead);
  } else {
    bodyText = [
      `${english ? "Dear" : "Bonjour"}${firstName(lead.traveler_name) ? ` ${firstName(lead.traveler_name)}` : ""},`,
      kind === "welcome" ? english ? "Thank you for sharing your travel project. We have received your enquiry and our team will help shape it with local experts." : "Merci de nous avoir confié votre projet de voyage. Nous avons bien reçu votre demande et notre équipe va vous accompagner pour la préciser avec nos partenaires locaux." : english ? "We are continuing the preparation of your travel project. A few details will help us prepare an accurate brief for our local partners." : "Nous poursuivons la préparation de votre projet. Quelques précisions nous aideront à transmettre un brief complet et fidèle à nos partenaires locaux.",
      questionText ? `${english ? "To begin, could you please confirm the following details?" : "Pour commencer, pourriez-vous nous préciser les points suivants ?"}\n\n${questionText}` : english ? "We have the main details needed to prepare your project. Please let us know if anything has changed." : "Nous disposons des principales informations pour préparer votre projet. N’hésitez pas à nous signaler toute évolution.",
      recap ? `${english ? "Your project so far" : "Votre projet à ce stade"}\n${recap}` : "",
      analysis.expedition ? english ? "We will first assess feasibility with local experts. No route, unsupported format or booking is confirmed at this stage." : "Nous commencerons par une étude de faisabilité avec les experts locaux. Aucun itinéraire, format en autonomie ou réservation n’est confirmé à ce stade." : "",
      english ? "You can simply reply to this email point by point, even if some details are still open. Direction l’Algérie remains your point of contact." : "Vous pouvez simplement répondre à cet email point par point, même si certains éléments restent ouverts. Direction l’Algérie reste votre interlocuteur pour la suite.",
      english ? "Kind regards,\nDirection l’Algérie" : "Bien cordialement,\nDirection l’Algérie",
    ].filter(Boolean).join("\n\n");
  }
  if (options.bodyText !== undefined) bodyText = kind === "agency_feasibility" ? anonymizeAgencyText(options.bodyText, lead) : options.bodyText;
  return { subject, bodyText, language, reference: ref, questions: analysis.questions, analysis,
    html: renderLeadEmailHtml({ kind, language, bodyText, travelerName: agency ? undefined : lead.traveler_name, reference: kind === "agency_feasibility" ? anonymizeAgencyText(ref, lead) : ref }) };
}
