"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Check } from "lucide-react";
import { retainAgencyProposal } from "@/app/(dashboard)/leads/actions";
import type { CoConstructionProposalRow } from "@/lib/co-construction-proposal";
import { coConstructionProposalStatusLabelFr } from "@/lib/co-construction-proposal";
import { useRouter } from "next/navigation";

type AgencyOption = { id: string; label: string };

type LeadProposalsTableProps = {
  leadId: string;
  proposals: CoConstructionProposalRow[];
  agencies: AgencyOption[];
  retainedAgencyId: string | null;
};

export function LeadProposalsTable({
  leadId,
  proposals,
  agencies,
  retainedAgencyId,
}: LeadProposalsTableProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  function handleRetain(proposal: CoConstructionProposalRow) {
    if (!proposal.agency_id) return;
    setError(null);
    startTransition(async () => {
      const res = await retainAgencyProposal(leadId, proposal.agency_id!, proposal.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const receivedProposals = proposals.filter(
    (p) => p.status === "submitted" || p.status === "approved",
  );
  const otherProposals = proposals.filter(
    (p) => p.status !== "submitted" && p.status !== "approved",
  );

  if (proposals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune proposition pour le moment. Revenez à l'étape «&nbsp;Assignation&nbsp;» pour envoyer
        le brief aux agences.
      </p>
    );
  }

  function AgencyRow({ p }: { p: CoConstructionProposalRow }) {
    const agencyLabel =
      agencies.find((a) => a.id === p.agency_id)?.label ?? "Agence inconnue";
    const isOpen = expanded === p.id;
    const isRetained = p.agency_id === retainedAgencyId;

    return (
      <div
        className={[
          "rounded-lg border",
          p.status === "approved" || isRetained
            ? "border-[var(--revenue-border)] bg-[var(--revenue-bg)]/30"
            : "border-border bg-panel",
        ].join(" ")}
      >
        <div className="flex items-start gap-3 p-3 sm:p-4">
          {/* Agency + status */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{agencyLabel}</span>
              {isRetained ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--revenue)] bg-[var(--revenue-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--revenue)]">
                  <Check className="size-3" aria-hidden /> Offre retenue
                </span>
              ) : (
                <span
                  className={[
                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    p.status === "submitted"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : p.status === "declined"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-blue-200 bg-blue-50 text-blue-800",
                  ].join(" ")}
                >
                  {coConstructionProposalStatusLabelFr[p.status]}
                </span>
              )}
            </div>

            {p.status === "submitted" || p.status === "approved" ? (
              <div className="mt-1.5 flex flex-wrap gap-3 text-sm text-foreground/80">
                {p.agency_proposal_price ? (
                  <span>
                    💶{" "}
                    <strong>
                      {p.agency_proposal_price.toLocaleString("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                        maximumFractionDigits: 0,
                      })}
                    </strong>
                  </span>
                ) : null}
                {p.agency_proposal_duration_days ? (
                  <span>
                    📅 <strong>{p.agency_proposal_duration_days} jours</strong>
                  </span>
                ) : null}
                {p.proposal_received_at ? (
                  <span className="text-muted-foreground">
                    reçue le{" "}
                    {new Date(p.proposal_received_at).toLocaleDateString("fr-FR")}
                  </span>
                ) : null}
              </div>
            ) : null}

            {p.agency_proposal_summary && !isOpen ? (
              <p className="mt-1 text-sm text-foreground/70 line-clamp-2">
                {p.agency_proposal_summary}
              </p>
            ) : null}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 gap-1.5">
            {p.agency_proposal_summary ? (
              <button
                type="button"
                onClick={() => toggle(p.id)}
                className="inline-flex items-center gap-1 rounded border border-border bg-panel-muted px-2 py-1.5 text-xs font-medium text-foreground hover:bg-panel"
              >
                {isOpen ? (
                  <ChevronUp className="size-3.5" aria-hidden />
                ) : (
                  <ChevronDown className="size-3.5" aria-hidden />
                )}
                {isOpen ? "Réduire" : "Détails"}
              </button>
            ) : null}

            {p.status === "submitted" && !isRetained ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => handleRetain(p)}
                className="inline-flex items-center gap-1 rounded border border-[var(--revenue)] bg-[var(--revenue-bg)] px-2 py-1.5 text-xs font-semibold text-[var(--revenue)] hover:bg-[var(--revenue)] hover:text-white disabled:opacity-45 transition-colors"
              >
                <Check className="size-3.5" aria-hidden />
                Retenir cette offre
              </button>
            ) : null}
          </div>
        </div>

        {isOpen && p.agency_proposal_summary ? (
          <div className="border-t border-border px-3 pb-3 pt-2.5 sm:px-4">
            <p className="whitespace-pre-wrap text-sm text-foreground/85">
              {p.agency_proposal_summary}
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {receivedProposals.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Propositions reçues ({receivedProposals.length})
          </h4>
          {receivedProposals.map((p) => (
            <AgencyRow key={p.id} p={p} />
          ))}
        </div>
      ) : null}

      {otherProposals.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Autres consultations ({otherProposals.length})
          </h4>
          {otherProposals.map((p) => (
            <AgencyRow key={p.id} p={p} />
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">{error}</p>
      ) : null}
    </div>
  );
}
