"use client";

import { useState, useTransition } from 'react';
import { Sparkles, Bot, UserCheck, Loader2, AlertCircle } from 'lucide-react';
import {
  runQualificationSuggestions,
  setLeadManualTakeover,
  type QualificationBlockResult,
} from '@/app/(dashboard)/leads/ai-actions';
import type { QualificationBlocks } from '@/lib/qualification-blocks';

interface QualificationStatusBarProps {
  leadId: string;
  travelerName: string;
  workflowMode: 'ai' | 'manual' | null;
  manualTakeover: boolean;
  validatedCount: number;
  totalCount: number;
  onSuggestionsGenerated?: (blocks: QualificationBlocks) => void;
}

export function QualificationStatusBar({
  leadId,
  travelerName,
  workflowMode,
  manualTakeover,
  validatedCount,
  totalCount,
  onSuggestionsGenerated,
}: QualificationStatusBarProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isManual = manualTakeover || workflowMode === 'manual';

  function handleGenerateAll() {
    setError(null);
    startTransition(async () => {
      const res: QualificationBlockResult = await runQualificationSuggestions({ leadId });
      if (!res.ok) {
        setError(res.error);
      } else {
        onSuggestionsGenerated?.(res.blocks);
      }
    });
  }

  function handleToggleMode() {
    startTransition(async () => {
      await setLeadManualTakeover(leadId, !isManual);
    });
  }

  return (
    <div className="rounded-[8px] border border-[#e4e8eb] bg-[#f4f7fa] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isManual ? (
            <UserCheck className="h-4 w-4 text-[#6b7a85]" />
          ) : (
            <Bot className="h-4 w-4 text-violet-600" />
          )}
          <span className="text-[13px] font-medium text-[#0e1a21]">
            {isManual ? 'Mode manuel' : 'Mode IA actif'}
          </span>
          <span className="text-[12px] text-[#6b7a85]">
            · {validatedCount}/{totalCount} blocs validés
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isManual && (
            <button
              type="button"
              disabled={isPending || validatedCount === totalCount}
              onClick={handleGenerateAll}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-violet-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Générer toutes les suggestions
            </button>
          )}
          <button
            type="button"
            disabled={isPending}
            onClick={handleToggleMode}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#e4e8eb] bg-white px-3 py-1.5 text-[12px] font-medium text-[#3a4a55] transition-colors hover:border-[#9aa7b0] disabled:opacity-50"
          >
            {isManual ? (
              <>
                <Bot className="h-3.5 w-3.5" />
                Réactiver l&apos;IA
              </>
            ) : (
              <>
                <UserCheck className="h-3.5 w-3.5" />
                Passer en manuel
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-2 flex items-center gap-2 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
