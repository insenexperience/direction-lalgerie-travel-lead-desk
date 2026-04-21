"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Mail, Copy, Check } from "lucide-react";
import { setPreferredChannel } from "@/app/(dashboard)/leads/actions";
import { useRouter } from "next/navigation";

type LeadPreferredChannelSelectorProps = {
  leadId: string;
  preferredChannel: "whatsapp" | "email" | null;
  travelerName: string;
  reference: string | null;
};

const RELANCE_TEMPLATE = (name: string, ref: string | null) =>
  `Bonjour ${name.trim().split(" ")[0] ?? ""},\n\nNous n'avons pas encore reçu de nouvelles de votre part concernant votre projet de voyage${ref ? ` (réf. ${ref})` : ""}.\n\nN'hésitez pas à nous contacter via WhatsApp ou par email — nous sommes disponibles pour construire votre voyage ensemble.\n\nBonne journée,\n— L'équipe Direction l'Algérie`;

export function LeadPreferredChannelSelector({
  leadId,
  preferredChannel,
  travelerName,
  reference,
}: LeadPreferredChannelSelectorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copiedRelance, setCopiedRelance] = useState(false);

  function choose(channel: "whatsapp" | "email") {
    setError(null);
    startTransition(async () => {
      const res = await setPreferredChannel(leadId, channel);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function copyRelance() {
    void navigator.clipboard
      .writeText(RELANCE_TEMPLATE(travelerName, reference))
      .then(() => {
        setCopiedRelance(true);
        setTimeout(() => setCopiedRelance(false), 2000);
      });
  }

  if (preferredChannel) {
    const isWhatsApp = preferredChannel === "whatsapp";
    return (
      <div
        className={[
          "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
          isWhatsApp
            ? "border-[var(--revenue-border)] bg-[var(--revenue-bg)] text-[var(--revenue)]"
            : "border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info)]",
        ].join(" ")}
      >
        {isWhatsApp ? (
          <MessageCircle className="size-4 shrink-0" aria-hidden />
        ) : (
          <Mail className="size-4 shrink-0" aria-hidden />
        )}
        <span>
          Canal préféré détecté :{" "}
          <strong>{isWhatsApp ? "WhatsApp" : "Email"}</strong>
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 size-2 shrink-0 rounded-full bg-amber-500 animate-pulse" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-amber-900">
            En attente de la première réponse du voyageur
          </p>
          <p className="mt-0.5 text-xs text-amber-800/80">
            Le canal préféré sera défini par le bouton sur lequel le voyageur cliquera
            dans l'email de bienvenue. En cas de contact direct, indiquez le canal ici.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => choose("whatsapp")}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--revenue)] bg-[var(--revenue-bg)] px-3 py-2 text-sm font-semibold text-[var(--revenue)] transition-colors hover:bg-[var(--revenue)] hover:text-white disabled:opacity-45"
        >
          <MessageCircle className="size-4 shrink-0" aria-hidden />
          {pending ? "…" : "Le voyageur a répondu par WhatsApp"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => choose("email")}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--info)] bg-[var(--info-bg)] px-3 py-2 text-sm font-semibold text-[var(--info)] transition-colors hover:bg-[var(--info)] hover:text-white disabled:opacity-45"
        >
          <Mail className="size-4 shrink-0" aria-hidden />
          {pending ? "…" : "Le voyageur a répondu par email"}
        </button>
        <button
          type="button"
          onClick={copyRelance}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-panel-muted"
        >
          {copiedRelance ? (
            <Check className="size-4 text-[var(--revenue)]" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copiedRelance ? "Copié !" : "Copier template relance"}
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">{error}</p>
      ) : null}
    </div>
  );
}
