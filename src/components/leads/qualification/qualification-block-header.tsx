"use client";

import { useTransition } from 'react';
import { CheckCircle2, Clock, Sparkles, Edit2, type LucideIcon } from 'lucide-react';
import type { QualificationBlock, BlockId } from '@/lib/qualification-blocks';
import { reopenQualificationBlock } from '@/app/(dashboard)/leads/ai-actions';

interface QualificationBlockHeaderProps {
  leadId: string;
  blockId: BlockId;
  label: string;
  icon: LucideIcon;
  block: QualificationBlock;
  onReopened?: () => void;
}

function StatusBadge({ block }: { block: QualificationBlock }) {
  if (block.op_action !== null) {
    const label = block.op_action === 'confirmed' ? 'Confirmé'
      : block.op_action === 'adjusted' ? 'Ajusté'
      : 'Manuel';
    return (
      <span className="inline-flex items-center gap-1 rounded-[4px] border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        {label}
      </span>
    );
  }
  if (block.ai_status === 'ready_for_review') {
    return (
      <span className="inline-flex items-center gap-1 rounded-[4px] border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
        <Sparkles className="h-3 w-3" />
        Prêt à valider
      </span>
    );
  }
  if (block.ai_status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1 rounded-[4px] border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
        <Clock className="h-3 w-3 animate-pulse" />
        IA en cours…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-[4px] border border-[#e4e8eb] bg-[#f6f7f8] px-2 py-0.5 text-[11px] font-semibold text-[#9aa7b0]">
      En attente
    </span>
  );
}

export function QualificationBlockHeader({
  leadId,
  blockId,
  label,
  icon: Icon,
  block,
  onReopened,
}: QualificationBlockHeaderProps) {
  const [isPending, startTransition] = useTransition();

  function handleReopen() {
    startTransition(async () => {
      await reopenQualificationBlock({ leadId, blockId });
      onReopened?.();
    });
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#f4f7fa] text-[#15323f]">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[13px] font-semibold text-[#0e1a21]">{label}</span>
        <StatusBadge block={block} />
      </div>
      {block.op_action !== null && (
        <button
          type="button"
          disabled={isPending}
          onClick={handleReopen}
          className="inline-flex items-center gap-1 rounded-[5px] border border-[#e4e8eb] bg-white px-2 py-1 text-[11px] font-medium text-[#3a4a55] transition-colors hover:border-[#9aa7b0] disabled:opacity-50"
        >
          <Edit2 className="h-3 w-3" />
          Modifier
        </button>
      )}
    </div>
  );
}
