"use client";

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import type { QualificationBlock, BlockId } from '@/lib/qualification-blocks';
import {
  validateQualificationBlock,
  updateBlockSelections,
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
    block.op_selections ?? []
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleReopened() {
    setLocalBlock(prev => ({ ...prev, op_action: null, op_validated_at: null }));
    setLocalSelections(localBlock.op_selections ?? []);
  }

  function handleToggle(optionId: string) {
    const next = localSelections.includes(optionId)
      ? localSelections.filter(id => id !== optionId)
      : [...localSelections, optionId];
    setLocalSelections(next);
    startTransition(async () => {
      await updateBlockSelections({ leadId, blockId: config.id as BlockId, selections: next });
    });
  }

  function handleValidate() {
    setError(null);
    startTransition(async () => {
      const res = await validateQualificationBlock({
        leadId,
        blockId: config.id as BlockId,
        selections: localSelections,
        action: 'manual',
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        setLocalBlock(prev => ({
          ...prev,
          op_action: 'manual',
          op_selections: localSelections,
          op_validated_at: new Date().toISOString(),
        }));
      }
    });
  }

  const isValidated = localBlock.op_action !== null;

  return (
    <div
      className={[
        'rounded-[8px] border bg-white p-4 transition-all',
        isValidated ? 'border-emerald-200' : 'border-[#e4e8eb]',
      ].join(' ')}
    >
      <QualificationBlockHeader
        leadId={leadId}
        blockId={config.id as BlockId}
        label={config.label}
        icon={config.icon}
        block={localBlock}
        onReopened={handleReopened}
      />

      {/* Validated state — read-only chips */}
      {isValidated && (
        <div className="mt-3">
          <QualificationChips
            options={config.sections.flatMap(s => s.options)}
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

      {/* Edit state — chips + validate button */}
      {!isValidated && (
        <div className="mt-3 space-y-4">
          <p className="text-[12px] text-[#9aa7b0]">{config.description}</p>

          {config.sections.map(section => (
            <div key={section.id} className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9aa7b0]">
                {section.label}
                {section.required && <span className="ml-1 text-[#c1411f]">*</span>}
              </p>
              <QualificationChips
                options={section.options}
                selected={localSelections}
                aiSuggested={[]}
                onToggle={handleToggle}
                disabled={isPending}
              />
            </div>
          ))}

          {error && (
            <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
              {error}
            </p>
          )}

          <div className="border-t border-[#f4f7fa] pt-3">
            <button
              type="button"
              disabled={isPending || localSelections.length === 0}
              onClick={handleValidate}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#15323f] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#0e1a21] disabled:opacity-40"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Valider ce bloc
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
