"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import {
  compareAgencyProposals,
  generateAgencyShortlist,
  setLeadManualTakeover,
  validateLeadQualification,
} from "@/app/(dashboard)/leads/ai-actions";
import { ContextBanner } from "@/components/leads/context-banner";
import type { TranscriptEntry } from "@/lib/ai/types";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";

function transcriptEntries(raw: unknown): TranscriptEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: TranscriptEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const ts = typeof o.ts === "string" ? o.ts : "";
    const from =
      o.from === "traveler" || o.from === "ai" || o.from === "operator"
        ? o.from
        : "traveler";
    const text = typeof o.text === "string" ? o.text : "";
    if (text) out.push({ ts, from, text });
  }
  return out;
}

export function LeadAiOpsPanel({
  lead,
  hideAutopilotToggle,
}: {
  lead: SupabaseLeadRow;
  /** Masquer les boutons stop / reprise IA (contrôle dans la bande cockpit). */
  hideAutopilotToggle?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const entries = transcriptEntries(lead.conversation_transcript);
  const pendingQual = lead.qualification_validation_status === "pending";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setMsg(null);
    start(() => {
      void (async () => {
        const r = await fn();
        if (!r.ok) {
          setMsg(r.error ?? "Erreur");
          return;
        }
        router.refresh();
      })();
    });
  }

  return (
    <section
      id="lead-ai-ops-panel"
      className="rounded-md border border-border bg-panel p-4 sm:p-6"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Conversation voyageur &amp; IA
      </h3>
      {entries.length > 0 ? (
        <div className="mt-3">
          <ContextBanner variant="ia" title="Transcript" icon={Sparkles}>
            <span>
              {entries.length} message{entries.length > 1 ? "s" : ""} enregistré
              {entries.length > 1 ? "s" : ""} — voir le fil ci-dessous ou{" "}
              <a
                href="#lead-ai-transcript"
                className="font-semibold text-sky-900 underline decoration-sky-700/40 underline-offset-2 hover:decoration-sky-900"
              >
                accéder au transcript
              </a>
              .
            </span>
          </ContextBanner>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Transcript WhatsApp / IA (lecture seule). Aucun message enregistré pour l’instant.
        </p>
      )}
      {entries.length > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Activez la reprise manuelle (bandeau cockpit) pour suspendre l&apos;envoi automatique des
          messages IA.
        </p>
      ) : null}

      {hideAutopilotToggle ? null : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() => setLeadManualTakeover(lead.id, !lead.manual_takeover))
            }
            className="rounded-md border border-border bg-panel-muted px-3 py-2 text-sm font-semibold hover:bg-panel"
          >
            {lead.manual_takeover ? "Reprendre le fil IA" : "Reprise manuelle (stop IA)"}
          </button>
        </div>
      )}

      {pendingQual ? (
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-sm font-semibold text-foreground">
            Validation du brief — assignation agence
          </p>
          {!lead.ai_qualification_payload ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Pas encore de synthèse IA structurée sur ce dossier : validez tout de même le brief
              (fiche complète + contexte) pour débloquer le passage à l’étape « Assignation ».
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
              onClick={() => run(() => validateLeadQualification(lead.id, "validated"))}
            >
              Valider
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-panel-muted"
              onClick={() => run(() => validateLeadQualification(lead.id, "overridden"))}
            >
              Marquer comme ajustée / validée
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900 hover:opacity-95 disabled:opacity-50"
              onClick={() => run(() => validateLeadQualification(lead.id, "rejected"))}
            >
              Rejeter
            </button>
          </div>
        </div>
      ) : null}

      {(lead.qualification_validation_status === "validated" ||
        lead.qualification_validation_status === "overridden") && (
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-sm font-semibold text-foreground">Shortlist &amp; comparaison</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className="rounded-md bg-[#182b35] px-3 py-2 text-sm font-semibold text-[#f3f7fa] hover:opacity-95 disabled:opacity-50"
              onClick={() => run(() => generateAgencyShortlist(lead.id))}
            >
              Générer shortlist IA
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-panel-muted"
              onClick={() => run(() => compareAgencyProposals(lead.id))}
            >
              Comparer les propositions
            </button>
          </div>
        </div>
      )}

      {msg ? (
        <p className="mt-3 text-sm text-red-600" role="status">
          {msg}
        </p>
      ) : null}

      <div
        id="lead-ai-transcript"
        className="mt-6 max-h-80 space-y-2 overflow-y-auto scroll-mt-28 rounded-md border border-border bg-panel-muted/40 p-3"
      >
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun message enregistré.</p>
        ) : (
          entries.map((m, i) => (
            <div
              key={`${m.ts}-${i}`}
              className={[
                "rounded-md px-3 py-2 text-sm",
                m.from === "traveler"
                  ? "ml-4 bg-white text-foreground shadow-sm"
                  : m.from === "operator"
                    ? "mr-4 bg-amber-50 text-amber-950"
                    : "mr-4 bg-[#182b35] text-[#f3f7fa]",
              ].join(" ")}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                {m.from === "traveler"
                  ? "Voyageur"
                  : m.from === "operator"
                    ? "Opérateur"
                    : "Direction l'Algérie"}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{m.text}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
