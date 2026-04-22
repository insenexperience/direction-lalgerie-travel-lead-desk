"use client";

import { useState, useTransition } from "react";
import { Copy, Check, Send } from "lucide-react";
import { markWelcomeEmailSent, cancelWelcomeEmailSent } from "@/app/(dashboard)/leads/actions";
import {
  buildWorkflowWelcomeEmailAiHtml,
  normalizeWhatsAppE164,
} from "@/lib/email/workflow-welcome";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";
import { useRouter } from "next/navigation";

type LeadWelcomeEmailSenderProps = {
  lead: SupabaseLeadRow;
};

export function LeadWelcomeEmailSender({ lead }: LeadWelcomeEmailSenderProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cancelPending, startCancel] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(Boolean(lead.welcome_email_sent_at));

  const daNumber =
    process.env.NEXT_PUBLIC_WHATSAPP_DA_NUMBER ?? "+213795274309";
  const daEmail =
    process.env.NEXT_PUBLIC_DA_CONTACT_EMAIL ?? "";
  const ref = lead.reference ?? "";

  const normalizedNumber = normalizeWhatsAppE164(daNumber);
  const waText = encodeURIComponent(
    `Bonjour, suite à votre email je souhaite co-construire mon voyage en Algérie. Réf. ${ref}`,
  );
  const whatsappHref = normalizedNumber
    ? `https://wa.me/${normalizedNumber}?text=${waText}`
    : "#";

  const mailSubject = encodeURIComponent(
    `Voyage Algérie — Réf. ${ref}`,
  );
  const mailBody = encodeURIComponent(
    `Bonjour,\n\nJe souhaite poursuivre mon projet de voyage (référence : ${ref}).\n\n`,
  );
  const mailtoHref = daEmail
    ? `mailto:${daEmail}?subject=${mailSubject}&body=${mailBody}`
    : "#";

  const html = buildWorkflowWelcomeEmailAiHtml(
    {
      traveler_name: lead.traveler_name,
      trip_summary: lead.trip_summary,
      travel_style: lead.travel_style,
      travelers: lead.travelers,
      budget: lead.budget,
      trip_dates: lead.trip_dates,
    },
    { whatsappHref, mailtoHref },
  );

  // Plain-text version for clipboard
  const plainText = [
    `Bonjour ${lead.traveler_name.trim().split(" ")[0] ?? ""},`,
    "",
    "Nous avons bien reçu votre demande de voyage. Direction l'Algérie sélectionne pour vous les agents experts de notre réseau pour construire un voyage sur mesure.",
    "",
    "Récapitulatif de votre projet :",
    `  Groupe    : ${lead.travelers}`,
    `  Période   : ${lead.trip_dates}`,
    `  Style     : ${lead.travel_style}`,
    `  Budget    : ${lead.budget}`,
    `  Projet    : ${lead.trip_summary}`,
    "",
    "Pour affiner votre projet avec nous :",
    `  WhatsApp (recommandé) : ${whatsappHref}`,
    `  Email                 : ${mailtoHref}`,
    "",
    "— L'équipe Direction l'Algérie",
  ].join("\n");

  function copyToClipboard() {
    void navigator.clipboard.writeText(plainText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCancel() {
    setError(null);
    startCancel(async () => {
      const res = await cancelWelcomeEmailSent(lead.id);
      if (!res.ok) { setError(res.error); return; }
      setSent(false);
      router.refresh();
    });
  }

  function handleSent() {
    setError(null);
    startTransition(async () => {
      const res = await markWelcomeEmailSent(lead.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSent(true);
      router.refresh();
    });
  }

  const sentAt = lead.welcome_email_sent_at
    ? new Date(lead.welcome_email_sent_at).toLocaleString("fr-FR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-panel p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Email de bienvenue — aperçu
        </h4>
        {sent ? (
          <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            <Check className="size-3" aria-hidden />
            Envoyé{sentAt ? ` le ${sentAt}` : ""}
          </span>
        ) : (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            À envoyer
          </span>
        )}
      </div>

      {/* Email preview */}
      <div
        className="max-h-64 overflow-y-auto rounded border border-border/70 bg-[var(--bg)] p-3 text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {!sent && (
        <p className="text-xs text-muted-foreground">
          Copiez le contenu et envoyez depuis votre boîte email.
          {"L'email"} contient deux CTA : WhatsApp (recommandé) et email.
          Le voyageur choisit son canal en cliquant.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyToClipboard}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-panel-muted"
        >
          {copied ? (
            <Check className="size-4 text-[var(--revenue)]" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copied ? "Copié !" : "Copier le contenu"}
        </button>

        {!sent && (
          <button
            type="button"
            disabled={pending || !lead.referent_id}
            onClick={handleSent}
            title={!lead.referent_id ? "Allouez d'abord un opérateur travel desk." : undefined}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--steel)] bg-[var(--steel)] px-3 py-2 text-sm font-semibold text-[var(--steel-ink)] transition-colors hover:opacity-90 disabled:pointer-events-none disabled:opacity-45"
          >
            <Send className="size-4" aria-hidden />
            {pending ? "Enregistrement…" : "J'ai envoyé l'email"}
          </button>
        )}

        {sent && (
          <button
            type="button"
            disabled={cancelPending}
            onClick={handleCancel}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
          >
            {cancelPending ? "Annulation…" : "Annuler l'envoi"}
          </button>
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">{error}</p>
      ) : null}
    </div>
  );
}
