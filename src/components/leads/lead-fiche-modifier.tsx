"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileEdit } from "lucide-react";
import { LeadEditForm } from "@/components/leads/lead-edit-form";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";

type LeadFicheModifierProps = {
  lead: SupabaseLeadRow;
};

export function LeadFicheModifier({ lead }: LeadFicheModifierProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-md border border-border bg-panel p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Fiche complète
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Tous les champs du dossier voyageur — ouvrez seulement pour corriger ou enrichir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-panel-muted px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-panel"
          aria-expanded={open}
        >
          {open ? (
            <>
              <ChevronDown className="size-4" aria-hidden />
              Fermer
            </>
          ) : (
            <>
              <FileEdit className="size-4" aria-hidden />
              Modifier la fiche
            </>
          )}
        </button>
      </div>

      {open ? (
        <div className="mt-5 border-t border-border pt-5">
          <LeadEditForm
            key={lead.updated_at}
            lead={lead}
            onSaved={() => setOpen(false)}
          />
        </div>
      ) : (
        <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
          <ChevronRight className="mt-0.5 size-4 shrink-0 opacity-70" aria-hidden />
          <span>
            Les menus ci-dessous correspondent à l’étape du pipeline. La fiche détaillée reste
            en lecture seule tant que vous ne cliquez pas sur « Modifier la fiche ».
          </span>
        </p>
      )}
    </section>
  );
}
