"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, GitBranch } from "lucide-react";
import { updateLeadStatus } from "@/app/(dashboard)/leads/actions";
import type { LeadStatus } from "@/lib/mock-leads";
import { LEAD_PIPELINE, leadStatusLabelFr } from "@/lib/mock-leads";

type LeadSupabasePipelineProps = {
  leadId: string;
  status: LeadStatus;
  referentId: string | null;
};

export function LeadSupabasePipeline({
  leadId,
  status,
  referentId,
}: LeadSupabasePipelineProps) {
  const router = useRouter();
  const [localStatus, setLocalStatus] = useState<LeadStatus>(status);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setLocalStatus(status);
  }, [status]);

  const currentIndex = LEAD_PIPELINE.indexOf(localStatus);
  const canAdvance = Boolean(referentId);

  async function applyStatus(next: LeadStatus) {
    if (next === localStatus) return;
    setFeedback(null);
    setPending(true);
    const result = await updateLeadStatus(leadId, next);
    setPending(false);
    if (!result.ok) {
      setFeedback(result.error);
      return;
    }
    setLocalStatus(next);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]">
        <ol className="flex min-w-max items-stretch gap-0 border border-border bg-panel">
          {LEAD_PIPELINE.map((step, index) => {
            const done = currentIndex > index;
            const current = localStatus === step;
            return (
              <li
                key={step}
                className={[
                  "relative flex items-center border-r border-border px-3 py-2.5 text-xs font-semibold last:border-r-0 sm:px-4 sm:text-sm",
                  current
                    ? "bg-[#182b35]"
                    : done
                      ? "bg-panel-muted"
                      : "bg-panel",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex items-center gap-1.5",
                    current
                      ? "text-[#f3f7fa]"
                      : done
                        ? "text-foreground/80"
                        : "text-muted-foreground",
                  ].join(" ")}
                >
                  {done ? (
                    <Check className="size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-current text-[10px] tabular-nums">
                      {index + 1}
                    </span>
                  )}
                  <span className="max-w-[7.5rem] truncate sm:max-w-[9rem]">
                    {leadStatusLabelFr[step]}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <section className="rounded-md border border-border bg-panel p-4 sm:p-6">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <GitBranch className="size-4 text-steel" aria-hidden />
          Faire avancer le dossier
        </h3>
        <p className="mt-2 text-sm text-foreground/85">
          {canAdvance
            ? "Choisissez l’étape du pipeline. Les changements sont enregistrés dans Supabase."
            : "Allouez d’abord un opérateur travel desk (étape « Nouveau ») pour débloquer les étapes suivantes."}
        </p>
        <label className="mt-4 block text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Étape</span>
          <select
            value={localStatus}
            disabled={pending || !canAdvance}
            onChange={(e) => void applyStatus(e.target.value as LeadStatus)}
            className="mt-2 w-full max-w-md rounded-md border border-border bg-panel-muted px-3 py-2 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-steel/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {LEAD_PIPELINE.map((s) => (
              <option
                key={s}
                value={s}
                disabled={!canAdvance && s !== "new"}
              >
                {leadStatusLabelFr[s]}
              </option>
            ))}
          </select>
        </label>
        {pending ? (
          <p className="mt-2 text-xs text-muted-foreground">Enregistrement…</p>
        ) : null}
        {feedback ? (
          <p className="mt-2 text-sm text-red-600" role="status">
            {feedback}
          </p>
        ) : null}
      </section>
    </div>
  );
}
