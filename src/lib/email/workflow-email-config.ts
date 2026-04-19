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
 * Quand `resendReady` est false, les actions de workflow avancent quand même le dossier mais n’appellent pas l’API Resend.
 */
export function getWorkflowEmailDeliveryHints(): WorkflowEmailDeliveryHints {
  const resendReady = isResendOutboundConfigured();
  const aiWelcomeTemplateReady = isAiWelcomeEmailCtAsConfigured();

  let bannerMessage: string | null = null;
  if (!resendReady) {
    bannerMessage =
      "Les emails voyageur (Resend) ne sont pas configurés sur cet environnement. Vous pouvez quand même lancer le workflow : le statut passera en qualification, sans envoi automatique. Pour activer l’envoi, définissez RESEND_API_KEY et RESEND_FROM_EMAIL (voir .env.example).";
  } else if (!aiWelcomeTemplateReady) {
    bannerMessage =
      "Le mode « IA » enverra un email de bienvenue simplifié (sans boutons WhatsApp / mailto) tant que NEXT_PUBLIC_WHATSAPP_DA_NUMBER et NEXT_PUBLIC_DA_CONTACT_EMAIL (ou RESEND_FROM_EMAIL) ne sont pas tous renseignés.";
  }

  return { resendReady, aiWelcomeTemplateReady, bannerMessage };
}
