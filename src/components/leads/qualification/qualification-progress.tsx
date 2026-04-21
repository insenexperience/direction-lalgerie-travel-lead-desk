"use client";

import type { QualificationBlocks, BlockId } from '@/lib/qualification-blocks';
import { BLOCK_IDS } from '@/lib/qualification-blocks';
import { QUALIFICATION_BLOCKS_CONFIG } from './qualification-blocks-config';

interface QualificationProgressProps {
  blocks: QualificationBlocks;
}

function segmentColor(block: QualificationBlocks[BlockId]): string {
  if (block.op_action !== null) return 'bg-emerald-500';
  if (block.ai_status === 'ready_for_review') return 'bg-blue-400';
  if (block.ai_status === 'in_progress') return 'bg-amber-400';
  return 'bg-[#e4e8eb]';
}

export function QualificationProgress({ blocks }: QualificationProgressProps) {
  const validated = BLOCK_IDS.filter(id => blocks[id].op_action !== null).length;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {BLOCK_IDS.map(id => {
            const config = QUALIFICATION_BLOCKS_CONFIG.find(c => c.id === id);
            return (
              <div key={id} className="group relative flex-1">
                <div
                  className={[
                    'h-1.5 rounded-full transition-colors',
                    segmentColor(blocks[id]),
                  ].join(' ')}
                />
                <div className="absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#0e1a21] px-2 py-1 text-[11px] text-white group-hover:block">
                  {config?.label ?? id}
                </div>
              </div>
            );
          })}
        </div>
        <span className="shrink-0 text-[12px] font-medium text-[#6b7a85]">
          {validated}/{BLOCK_IDS.length}
        </span>
      </div>
      <div className="flex gap-3 text-[11px] text-[#9aa7b0]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Validé
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
          À réviser
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
          En cours
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#e4e8eb]" />
          En attente
        </span>
      </div>
    </div>
  );
}
