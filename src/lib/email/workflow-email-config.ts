import { normalizeWhatsAppE164 } from "@/lib/email/workflow-welcome";

/** Resend utilisable côté serveur pour envoyer un message (clé + expéditeur). */
export function isResendOutboundConfigured(): boolean {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  return Boolean(key && from && from.includes("@"));
}

/** Liens CTA complets pour le template email « mode IA » (WhatsApp + mailto). */
export function isAiWelcomeEmailCtAsConfigured(): boolean {
  const wa = normalizeWhatsAppE164(process.env.NEXT_PUBLIC_WHATSAPP_DA_NUMBER ?? "");
  const contact =
    process.env.NEXT_PUBLIC_DA_CONTACT_EMAIL?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim();
  return Boolean(wa && contact && contact.includes("@"));
}

export type WorkflowEmailDeliveryHints = {
  resendReady: boolean;
  aiWelcomeTemplateReady: boolean;
  /** Message opérateur (null si tout est prêt pour l’envoi nominal). */
  bannerMessage: string | null;
};

/**
 * Résumé pour l’UI : prévoir le branchement Resend / variables publiques sans bloquer le desk.
 * Le lancement d’un workflow prépare le dossier ; l’envoi reste une action
 * explicite du module mailing après relecture du brouillon.
 */
export function getWorkflowEmailDeliveryHints(): WorkflowEmailDeliveryHints {
  const resendReady = isResendOutboundConfigured();
  const aiWelcomeTemplateReady = isAiWelcomeEmailCtAsConfigured();

  let bannerMessage: string | null = null;
  if (!resendReady) {
    bannerMessage =
      "Resend n’est pas configuré sur cet environnement. Préparez et modifiez les emails dans le module mailing, puis copiez-les dans votre messagerie et indiquez un envoi externe. Le workflow peut être lancé sans envoi automatique.";
  }

  return { resendReady, aiWelcomeTemplateReady, bannerMessage };
}
