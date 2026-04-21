"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, Trash2, RotateCcw, Workflow, UserPlus } from "lucide-react";
import { softDeleteLead, resetLeadToNew, copyLeadToContact } from "@/app/(dashboard)/leads/actions";

type LeadDetailDeleteZoneProps = {
  leadId: string;
  travelerName: string;
};

type ConfirmState =
  | { action: "delete" }
  | { action: "reset" }
  | { action: "copy_contact" }
  | null;

export function LeadDetailDeleteZone({ leadId, travelerName }: LeadDetailDeleteZoneProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  function runAction(action: ConfirmState) {
    if (!action) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      if (action.action === "delete") {
        const res = await softDeleteLead(leadId);
        if (!res.ok) { setError(res.error); return; }
        router.push("/leads");
        router.refresh();
      } else if (action.action === "reset") {
        const res = await resetLeadToNew(leadId);
        if (!res.ok) { setError(res.error); return; }
        setSuccess("Le lead a été réinitialisé à l'étape Nouveau.");
        router.refresh();
      } else if (action.action === "copy_contact") {
        const res = await copyLeadToContact(leadId);
        if (!res.ok) { setError(res.error); return; }
        setSuccess("Contact créé ou mis à jour avec succès.");
        router.refresh();
      }
      setConfirm(null);
    });
  }

  const CONFIRM_MESSAGES: Record<string, string> = {
    delete:       `Ce lead sera masqué de toutes les vues. Action réversible par l'admin technique.`,
    reset:        `L'étape sera remise à « Nouveau » et l'historique des transitions sera effacé.`,
    copy_contact: `Les informations du voyageur seront copiées dans la fiche Contact (création si email inconnu, rattachement si déjà existant).`,
  };

  return (
    <section className="rounded-[8px] border border-red-200/60 bg-[#faf8f8] p-4">
      {/* En-tête */}
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="size-4 text-red-500 shrink-0" aria-hidden />
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-red-700">
          Actions sensibles
        </h3>
      </div>

      {/* Messages */}
      {error && (
        <p className="mb-3 rounded-[4px] bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-3 rounded-[4px] bg-green-50 border border-green-200 px-3 py-2 text-[12px] text-green-700">
          {success}
        </p>
      )}

      {/* Boîte de confirmation inline */}
      {confirm && (
        <div className="mb-3 rounded-[6px] border border-amber-200 bg-amber-50 p-3">
          <p className="text-[12px] text-amber-800 mb-3">{CONFIRM_MESSAGES[confirm.action]}</p>
          <div className="flex gap-2">
            <button
              onClick={() => runAction(confirm)}
              disabled={pending}
              className="rounded-[4px] bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "En cours…" : "Confirmer"}
            </button>
            <button
              onClick={() => setConfirm(null)}
              disabled={pending}
              className="rounded-[4px] border border-[#e4e8eb] bg-white px-3 py-1.5 text-[12px] font-medium text-[#3a4a55] hover:bg-[#f6f7f8] disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {/* Réinitialiser */}
        <ActionButton
          icon={<RotateCcw className="size-3.5" aria-hidden />}
          label="Réinitialiser le lead"
          description="Remet l'étape à Nouveau, efface l'historique des transitions."
          onClick={() => setConfirm({ action: "reset" })}
          disabled={pending || !!confirm}
          variant="warning"
        />

        {/* Supprimer le workflow — placeholder */}
        <ActionButton
          icon={<Workflow className="size-3.5 opacity-40" aria-hidden />}
          label="Supprimer le workflow"
          description="Module workflow — disponible dans une prochaine version."
          onClick={() => {}}
          disabled
          variant="neutral"
        />

        {/* Copier dans Contact */}
        <ActionButton
          icon={<UserPlus className="size-3.5" aria-hidden />}
          label="Copier dans Contact"
          description="Crée ou met à jour la fiche Contact avec les infos du voyageur."
          onClick={() => setConfirm({ action: "copy_contact" })}
          disabled={pending || !!confirm}
          variant="info"
        />

        {/* Supprimer le lead */}
        <ActionButton
          icon={<Trash2 className="size-3.5" aria-hidden />}
          label="Supprimer le lead"
          description={`Masque « ${travelerName} » de toutes les vues (soft delete).`}
          onClick={() => setConfirm({ action: "delete" })}
          disabled={pending || !!confirm}
          variant="danger"
        />
      </div>
    </section>
  );
}

type ActionButtonProps = {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  variant: "danger" | "warning" | "info" | "neutral";
};

function ActionButton({ icon, label, description, onClick, disabled, variant }: ActionButtonProps) {
  const colors = {
    danger:  "text-red-700 hover:bg-red-50 border-red-200/60",
    warning: "text-amber-700 hover:bg-amber-50 border-amber-200/60",
    info:    "text-[#1e5a8a] hover:bg-blue-50 border-blue-200/40",
    neutral: "text-[#9aa7b0] border-[#e4e8eb] cursor-not-allowed",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-start gap-2.5 rounded-[6px] border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${colors[variant]}`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-[12px] font-semibold">{label}</p>
        <p className="text-[11px] opacity-70 mt-0.5">{description}</p>
      </div>
    </button>
  );
}
