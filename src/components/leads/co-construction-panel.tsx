"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  type ActionResult,
  approveCircuitProposal,
  createCircuitProposal,
  deleteCircuitProposal,
  generateQuoteFromProposal,
  submitCircuitProposalFromAgency,
  updateCircuitProposalOutline,
} from "@/app/(dashboard)/leads/co-construction-actions";
import type { CoConstructionProposalRow } from "@/lib/co-construction-proposal";
import { coConstructionProposalStatusLabelFr } from "@/lib/co-construction-proposal";
import { formatFrDateTimeShort } from "@/lib/format-fr-date-time";

type CoConstructionPanelProps = {
  leadId: string;
  proposals: CoConstructionProposalRow[];
  editable: boolean;
};

async function exec(
  fn: () => Promise<ActionResult>,
  setMessage: (s: string | null) => void,
  refresh: () => void,
): Promise<void> {
  setMessage(null);
  const res = await fn();
  if (!res.ok) {
    setMessage(res.error);
    return;
  }
  refresh();
}

export function CoConstructionPanel({
  leadId,
  proposals,
  editable,
}: CoConstructionPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  function run(fn: () => Promise<ActionResult>) {
    startTransition(() => {
      void exec(fn, setMessage, refresh);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground/90">
          Propositions de circuit : en attente de l&apos;agence, puis réception, modification,
          validation travel desk, enfin génération du devis.
        </p>
        {editable ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => createCircuitProposal(leadId))}
            className="shrink-0 rounded-md border border-[#182b35] bg-[#182b35] px-3 py-2 text-sm font-semibold text-[#f3f7fa] transition-colors hover:bg-[#213e4b] disabled:opacity-50"
          >
            + Nouvelle proposition
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {message}
        </p>
      ) : null}

      {proposals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {editable
            ? "Aucune proposition pour l’instant — créez-en une pour lancer la co-construction."
            : "Aucune proposition enregistrée sur ce dossier."}
        </p>
      ) : (
        <ul className="space-y-6">
          {proposals.map((p) => (
            <li
              key={p.id}
              className="rounded-md border border-border bg-panel-muted/30 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
                <div>
                  <p className="font-semibold text-foreground">{p.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Version {p.version} — {formatFrDateTimeShort(p.created_at)}
                  </p>
                  {p.ai_match_score != null || p.ai_proposal_score != null ? (
                    <p className="mt-2 text-xs text-foreground/90">
                      {p.ai_match_score != null ? (
                        <span className="mr-3">
                          Match IA : {(p.ai_match_score * 100).toFixed(0)}%
                          {p.ai_recommended ? " · recommandée" : ""}
                        </span>
                      ) : null}
                      {p.ai_proposal_score != null ? (
                        <span>
                          Proposition IA : {(p.ai_proposal_score * 100).toFixed(0)}%
                          {p.ai_recommended ? " · recommandée" : ""}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                  {p.ai_match_rationale || p.ai_proposal_rationale ? (
                    <p className="mt-1 text-xs italic text-muted-foreground">
                      {p.ai_proposal_rationale ?? p.ai_match_rationale}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="rounded-none border border-border bg-panel px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground/90">
                    {coConstructionProposalStatusLabelFr[p.status]}
                  </span>
                  {!p.converted_quote_id ? (
                    <button
                      type="button"
                      disabled={pending}
                      title="Supprimer cette proposition"
                      onClick={() => {
                        const ok = window.confirm(
                          `Supprimer la proposition « ${p.title} » (v${p.version}) ? Cette action est définitive.`,
                        );
                        if (!ok) return;
                        run(() => deleteCircuitProposal(p.id));
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50/90 px-2 py-1 text-[11px] font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5 shrink-0" aria-hidden />
                      Supprimer
                    </button>
                  ) : null}
                </div>
              </div>

              {p.status === "awaiting_agency" && editable ? (
                <AwaitingAgencyForm
                  pending={pending}
                  onSubmit={(fd) => run(() => submitCircuitProposalFromAgency(p.id, fd))}
                />
              ) : null}

              {p.status === "submitted" && editable ? (
                <SubmittedForms
                  proposal={p}
                  pending={pending}
                  onSaveOutline={(fd) =>
                    run(() => updateCircuitProposalOutline(p.id, fd))
                  }
                  onApprove={() => run(() => approveCircuitProposal(p.id))}
                />
              ) : null}

              {p.status === "submitted" && !editable ? (
                <OutlineReadOnly outline={p.circuit_outline} />
              ) : null}

              {p.status === "awaiting_agency" && !editable ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  En attente de la proposition agence (revenir en co-construction pour poursuivre).
                </p>
              ) : null}

              {p.status === "approved" ? (
                <ApprovedBlock
                  convertedQuoteId={p.converted_quote_id}
                  outline={p.circuit_outline}
                  editable={editable}
                  pending={pending}
                  onGenerate={() => run(() => generateQuoteFromProposal(p.id))}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OutlineReadOnly({ outline }: { outline: string }) {
  return (
    <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-panel p-3 text-sm text-foreground/90">
      {outline || "—"}
    </pre>
  );
}

function AwaitingAgencyForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (fd: FormData) => void;
}) {
  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      <p className="text-xs text-muted-foreground">
        Simulation dépôt agence : saisissez le circuit proposé par l&apos;agence partenaire, puis
        enregistrez. Le statut passera à « Reçue — modifiable ».
      </p>
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Titre
        <input
          name="title"
          defaultValue="Proposition de circuit"
          className="mt-1 w-full rounded-md border border-border bg-panel px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-steel/25"
        />
      </label>
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Circuit proposé *
        <textarea
          name="circuit_outline"
          required
          rows={8}
          placeholder="Itinéraire, nuits, expériences clés, niveau de service…"
          className="mt-1 w-full resize-y rounded-md border border-border bg-panel px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-steel/25"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-border bg-panel px-3 py-2 text-sm font-semibold text-foreground hover:bg-panel-muted disabled:opacity-50"
      >
        Enregistrer comme reçue de l&apos;agence
      </button>
    </form>
  );
}

function SubmittedForms({
  proposal,
  pending,
  onSaveOutline,
  onApprove,
}: {
  proposal: CoConstructionProposalRow;
  pending: boolean;
  onSaveOutline: (fd: FormData) => void;
  onApprove: () => void;
}) {
  return (
    <div className="mt-4 space-y-5">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSaveOutline(new FormData(e.currentTarget));
        }}
      >
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Titre
          <input
            name="title"
            defaultValue={proposal.title}
            className="mt-1 w-full rounded-md border border-border bg-panel px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/25"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Circuit (modifiable) *
          <textarea
            name="circuit_outline"
            required
            rows={10}
            defaultValue={proposal.circuit_outline}
            className="mt-1 w-full resize-y rounded-md border border-border bg-panel px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/25"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-border bg-panel px-3 py-2 text-sm font-semibold hover:bg-panel-muted disabled:opacity-50"
        >
          Enregistrer les modifications
        </button>
      </form>

      <div className="border-t border-border pt-4">
        <p className="text-sm text-foreground/90">
          Lorsque le parcours co-construit est conforme au projet à commercialiser, validez pour
          débloquer le devis et l&apos;étape suivante du pipeline.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={onApprove}
          className="mt-3 rounded-md border border-[#182b35] bg-[#182b35] px-3 py-2 text-sm font-semibold text-[#f3f7fa] hover:bg-[#213e4b] disabled:opacity-50"
        >
          Valider pour devis
        </button>
      </div>
    </div>
  );
}

function ApprovedBlock({
  convertedQuoteId,
  outline,
  editable,
  pending,
  onGenerate,
}: {
  convertedQuoteId: string | null;
  outline: string;
  editable: boolean;
  pending: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      <OutlineReadOnly outline={outline} />
      {convertedQuoteId ? (
        <p className="text-sm font-medium text-foreground">
          Devis généré — réf. interne{" "}
          <span className="font-mono text-xs">{convertedQuoteId.slice(0, 8)}…</span>
        </p>
      ) : editable ? (
        <div>
          <p className="text-sm text-muted-foreground">
            Générez un brouillon de devis (texte structuré) à partir de cette proposition et des
            infos voyageur. Le dossier passera à l&apos;étape « Devis ».
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={onGenerate}
            className="mt-2 rounded-md border border-[#182b35] bg-[#182b35] px-3 py-2 text-sm font-semibold text-[#f3f7fa] hover:bg-[#213e4b] disabled:opacity-50"
          >
            Générer le devis
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Proposition validée — utilisez l&apos;étape Devis pour la suite commerciale.
        </p>
      )}
    </div>
  );
}
