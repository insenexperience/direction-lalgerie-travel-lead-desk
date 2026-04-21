"use client";

import { useState, useTransition } from 'react';
import { Sparkles, Loader2, PenLine } from 'lucide-react';
import type { QualificationBlock, BlockId } from '@/lib/qualification-blocks';
import {
  validateQualificationBlock,
  updateBlockSelections,
  runQualificationSuggestions,
} from '@/app/(dashboard)/leads/ai-actions';
import type { BlockConfig } from './qualification-blocks-config';
import { QualificationBlockHeader } from './qualification-block-header';
import { QualificationChips } from './qualification-chips';

interface QualificationBlockProps {
  leadId: string;
  config: BlockConfig;
  block: QualificationBlock;
}

export function QualificationBlock({ leadId, config, block }: QualificationBlockProps) {
  const [localBlock, setLocalBlock] = useState<QualificationBlock>(block);
  const [localSelections, setLocalSelections] = useState<string[]>(
    block.op_selections ?? block.ai_suggestions ?? []
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleReopened() {
    setLocalBlock(prev => ({
      ...prev,
      op_action: null,
      op_validated_at: null,
    }));
    setLocalSelections(localBlock.op_selections ?? []);
  }

  function handleToggle(optionId: string) {
    const next = localSelections.includes(optionId)
      ? localSelections.filter(id => id !== optionId)
      : [...localSelections, optionId];
    setLocalSelections(next);
    startTransition(async () => {
      await updateBlockSelections({ leadId, blockId: config.id, selections: next });
    });
  }

  function handleValidate(action: 'confirmed' | 'adjusted' | 'manual') {
    setError(null);
    startTransition(async () => {
      const res = await validateQualificationBlock({
        leadId,
        blockId: config.id,
        selections: localSelections,
        action,
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        setLocalBlock(prev => ({
          ...prev,
          op_action: action,
          op_selections: localSelections,
          op_validated_at: new Date().toISOString(),
        }));
      }
    });
  }

  function handleGenerateSingle() {
    setError(null);
    setLocalBlock(prev => ({ ...prev, ai_status: 'in_progress' }));
    startTransition(async () => {
      const res = await runQualificationSuggestions({ leadId, blockId: config.id as BlockId });
      if (!res.ok) {
        setError(res.error);
        setLocalBlock(prev => ({ ...prev, ai_status: 'pending' }));
      } else {
        const updated = res.blocks[config.id];
        setLocalBlock(updated);
        setLocalSelections(updated.ai_suggestions ?? []);
      }
    });
  }

  const allOptions = config.sections.flatMap(s => s.options);
  const isValidated = localBlock.op_action !== null;
  const isInProgress = localBlock.ai_status === 'in_progress';
  const isReadyForReview = localBlock.ai_status === 'ready_for_review' && !isValidated;
  const isPending_ = localBlock.ai_status === 'pending' && !isValidated;

  return (
    <div
      className={[
        'rounded-[8px] border bg-white p-4 transition-all',
        isValidated ? 'border-emerald-200' : 'border-[#e4e8eb]',
      ].join(' ')}
    >
      <QualificationBlockHeader
        leadId={leadId}
        blockId={config.id}
        label={config.label}
        icon={config.icon}
        block={localBlock}
        onReopened={handleReopened}
      />

      {/* Validated state — read-only chips */}
      {isValidated && (
        <div className="mt-3">
          <QualificationChips
            options={allOptions}
            selected={localBlock.op_selections ?? []}
            aiSuggested={[]}
            onToggle={() => {}}
            disabled
          />
          {localBlock.op_validated_at && (
            <p className="mt-2 text-[11px] text-[#9aa7b0]">
              Validé le {new Date(localBlock.op_validated_at).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
      )}

      {/* In progress state */}
      {isInProgress && (
        <div className="mt-3 flex items-center gap-2 text-[13px] text-[#6b7a85]">
          <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
          Analyse IA en cours…
        </div>
      )}

      {/* Pending state */}
      {isPending_ && (
        <div className="mt-3 space-y-3">
          <p className="text-[12px] text-[#9aa7b0]">
            {config.description}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleGenerateSingle}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-violet-200 bg-violet-50 px-3 py-1.5 text-[12px] font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Suggestions IA
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setLocalBlock(prev => ({ ...prev, ai_status: 'ready_for_review' }))}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#e4e8eb] bg-white px-3 py-1.5 text-[12px] font-medium text-[#3a4a55] transition-colors hover:border-[#9aa7b0] disabled:opacity-50"
            >
              <PenLine className="h-3.5 w-3.5" />
              Remplir manuellement
            </button>
          </div>
        </div>
      )}

      {/* Ready for review state */}
      {isReadyForReview && (
        <div className="mt-3 space-y-4">
          {localBlock.ai_confidence != null && (
            <div className="flex items-center gap-2 text-[11px] text-[#6b7a85]">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              Confiance IA : {Math.round(localBlock.ai_confidence * 100)}%
              {localBlock.ai_missing.length > 0 && (
                <span className="text-amber-600">
                  · Sections incomplètes : {localBlock.ai_missing.join(', ')}
                </span>
              )}
            </div>
          )}

          {config.sections.map(section => (
            <div key={section.id} className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9aa7b0]">
                {section.label}
                {section.required && <span className="ml-1 text-[#c1411f]">*</span>}
              </p>
              <QualificationChips
                options={section.options}
                selected={localSelections}
                aiSuggested={localBlock.ai_suggestions}
                onToggle={handleToggle}
                disabled={isPending}
                aiConfidence={localBlock.ai_confidence}
              />
            </div>
          ))}

          {error && (
            <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2 border-t border-[#f4f7fa] pt-3">
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleValidate('confirmed')}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#15323f] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#0e1a21] disabled:opacity-50"
            >
              Confirmer les suggestions IA
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleValidate('adjusted')}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#e4e8eb] bg-white px-3 py-1.5 text-[12px] font-medium text-[#3a4a55] transition-colors hover:border-[#9aa7b0] disabled:opacity-50"
            >
              Valider mes ajustements
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleValidate('manual')}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#e4e8eb] bg-white px-3 py-1.5 text-[12px] font-medium text-[#6b7a85] transition-colors hover:border-[#9aa7b0] disabled:opacity-50"
            >
              Saisie manuelle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
