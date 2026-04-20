"use client";

import { useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";
import type { LeadStatus } from "@/lib/mock-leads";
import { claimLead } from "@/app/(dashboard)/leads/actions";
import { validateLeadQualification, generateAgencyShortlist } from "@/app/(dashboard)/leads/ai-actions";
import { launchWorkflowAi } from "@/app/(dashboard)/leads/workflow-actions";

type ActionConfig = {
  badge: string;
  badgeVariant: "hot" | "warn" | "info" | "revenue" | "neutral";
  title: string;
  cta: string;
  mode: "server-action" | "link" | "scroll";
  href?: string;
};

function resolveAction(lead: SupabaseLeadRow, currentUserId: string | null): ActionConfig {
  const { status, qualification_validation_status, workflow_launched_at, referent_id } = lead;

  if (status === "new") {
    if (!referent_id) {
      return { badge: "Action requise", badgeVariant: "hot", title: "Prendre ce lead en référent", cta: "Prendre le dossier", mode: "server-action" };
    }
    return { badge: "En attente", badgeVariant: "neutral", title: "Lead en cours de traitement", cta: "Voir le dossier", mode: "link", href: `/leads/${lead.id}` };
  }

  if (status === "qualification") {
    if (qualification_validation_status === "pending") {
      return { badge: "Validation IA", badgeVariant: "info", title: "Vérifier la qualification IA", cta: "Valider", mode: "server-action" };
    }
    if (!workflow_launched_at) {
      return { badge: "À démarrer", badgeVariant: "warn", title: "Lancer la conversation IA", cta: "Démarrer", mode: "server-action" };
    }
    return { badge: "En cours", badgeVariant: "neutral", title: "Qualification en cours", cta: "Voir le dossier", mode: "link", href: `/leads/${lead.id}` };
  }

  if (status === "agency_assignment") {
    return { badge: "Shortlist agences", badgeVariant: "warn", title: "Sélectionner 2–3 agences partenaires", cta: "Envoyer les consultations", mode: "scroll" };
  }

  if (status === "co_construction") {
    return { badge: "Itération en cours", badgeVariant: "info", title: "Suivre les retours des agences", cta: "Ouvrir", mode: "link", href: `/leads/${lead.id}` };
  }

  if (status === "quote") {
    return { badge: "Devis à envoyer", badgeVariant: "warn", title: "Finaliser et envoyer le devis", cta: "Créer le devis", mode: "link", href: `/leads/${lead.id}` };
  }

  if (status === "negotiation") {
    return { badge: "En négociation", badgeVariant: "warn", title: "Relancer ou ajuster le devis", cta: "Ouvrir", mode: "link", href: `/leads/${lead.id}` };
  }

  if (status === "won") {
    return { badge: "Gagné", badgeVariant: "revenue", title: "Déclencher le onboarding voyageur", cta: "Voir", mode: "link", href: `/leads/${lead.id}` };
  }

  return { badge: "Perdu", badgeVariant: "neutral", title: "Dossier clôturé", cta: "Voir le dossier", mode: "link", href: `/leads/${lead.id}` };
}

const badgeClasses: Record<ActionConfig["badgeVariant"], string> = {
  hot:     "bg-[#fceee9] text-[#c1411f]",
  warn:    "bg-[#fdf3e2] text-[#a8710b]",
  info:    "bg-[#e8f0f9] text-[#1e5a8a]",
  revenue: "bg-[#e6f4ee] text-[#0f6b4b]",
  neutral: "bg-[#f4f7fa] text-[#3a4a55]",
};

type NextActionCardProps = {
  lead: SupabaseLeadRow;
  currentUserId: string | null;
  onActionDone?: () => void;
};

export function NextActionCard({ lead, currentUserId, onActionDone }: NextActionCardProps) {
  const [isPending, startTransition] = useTransition();
  const config = resolveAction(lead, currentUserId);

  function handleAction() {
    if (config.mode !== "server-action") return;

    startTransition(async () => {
      const { status, qualification_validation_status } = lead;

      if (status === "new") {
        await claimLead(lead.id);
      } else if (status === "qualification" && qualification_validation_status === "pending") {
        await validateLeadQualification(lead.id, "validated");
        await generateAgencyShortlist(lead.id);
      } else if (status === "qualification" && !lead.workflow_launched_at) {
        await launchWorkflowAi(lead.id);
      }

      onActionDone?.();
    });
  }

  return (
    <div className="rounded-[8px] border border-[#e4e8eb] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className={`inline-flex w-fit items-center rounded-[4px] px-2 py-0.5 text-[11px] font-semibold ${badgeClasses[config.badgeVariant]}`}>
            {config.badge}
          </span>
          <p className="text-[14px] font-semibold text-[#0e1a21]">{config.title}</p>
        </div>

        {config.mode === "server-action" ? (
          <button
            type="button"
            onClick={handleAction}
            disabled={isPending}
            className="flex shrink-0 items-center gap-1.5 rounded-[6px] bg-[#15323f] px-3 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            )}
            {config.cta}
          </button>
        ) : config.mode === "link" && config.href ? (
          <Link
            href={config.href}
            className="flex shrink-0 items-center gap-1.5 rounded-[6px] bg-[#15323f] px-3 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            {config.cta}
          </Link>
        ) : (
          <a
            href="#agency-shortlist"
            className="flex shrink-0 items-center gap-1.5 rounded-[6px] bg-[#15323f] px-3 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            {config.cta}
          </a>
        )}
      </div>
    </div>
  );
}
