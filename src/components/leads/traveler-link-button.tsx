"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, RefreshCw } from "lucide-react";
import { generateTravelerLink } from "@/app/(dashboard)/leads/actions";

type Props = {
  leadId: string;
  /** true si le lead a déjà un public_token (affiche « Régénérer »). */
  hasToken: boolean;
};

export function TravelerLinkButton({ leadId, hasToken }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateTravelerLink(leadId);
      if (res.ok) setUrl(res.url);
      else setError(res.error);
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copie impossible — sélectionnez le lien manuellement.");
    }
  }

  return (
    <div>
      <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
        <Link2 className="size-3 shrink-0" aria-hidden />
        Lien voyageur
      </p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        Page publique où le voyageur complète sa qualification (valide{" "}
        {30} jours). Régénérer réouvre la soumission.
      </p>

      {url ? (
        <div className="mt-2 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded border border-border bg-panel-muted px-2 py-1 font-mono text-[11px] text-steel">
            {url}
          </code>
          <button
            type="button"
            onClick={copy}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-steel px-2.5 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            {copied ? (
              <>
                <Check className="size-3 shrink-0" aria-hidden />
                Copié
              </>
            ) : (
              <>
                <Copy className="size-3 shrink-0" aria-hidden />
                Copier
              </>
            )}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-steel px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <RefreshCw
            className={`size-3.5 shrink-0 ${pending ? "animate-spin" : ""}`}
            aria-hidden
          />
          {pending
            ? "Génération…"
            : hasToken
              ? "Régénérer le lien"
              : "Générer le lien"}
        </button>
      )}

      {error ? (
        <p className="mt-2 text-[12px] text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
