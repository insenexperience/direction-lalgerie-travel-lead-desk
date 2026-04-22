"use client";

import { useState, useTransition } from 'react';
import { CheckCircle2, Lock, ArrowRight, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { finalizeQualification, resetQualification } from '@/app/(dashboard)/leads/ai-actions';
import {
  allBlocksValidated,
  validatedBlocksCount,
  BLOCK_IDS,
  type QualificationBlocks,
} from '@/lib/qualification-blocks';
import { QUALIFICATION_BLOCKS_CONFIG } from './qualification-blocks-config';

interface QualificationGateProps {
  leadId: string;
  blocks: QualificationBlocks;
  leadSummary: {
    destination: string | null;
    travelers: string | null;
    budget: string | null;
  };
}

export function QualificationGate({ leadId, blocks, leadSummary }: QualificationGateProps) {
  const [finalizePending, startFinalize] = useTransition();
  const [resetPending, startReset] = useTransition();
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isComplete = allBlocksValidated(blocks);
  const validatedCount = validatedBlocksCount(blocks);
  const missingBlocks = BLOCK_IDS
    .filter(id => blocks[id].op_action === null)
    .map(id => QUALIFICATION_BLOCKS_CONFIG.find(c => c.id === id)?.label ?? id);

  function handleFinalize() {
    setError(null);
    startFinalize(async () => {
      const res = await finalizeQualification({ leadId });
      if (!res.ok) setError(res.error ?? 'Erreur lors de la validation.');
    });
  }

  function handleReset() {
    if (!confirmReset) { setConfirmReset(true); return; }
    setError(null);
    startReset(async () => {
      const res = await resetQualification(leadId);
      if (!res.ok) { setError(res.error ?? 'Erreur.'); setConfirmReset(false); return; }
      setConfirmReset(false);
    });
  }

  return (
    <div
      className={[
        'rounded-[8px] border-2 p-4 transition-all',
        isComplete ? 'border-emerald-300 bg-emerald-50' : 'border-[#e4e8eb] bg-[#f4f7fa]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {isComplete ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <Lock className="h-5 w-5 text-[#9aa7b0]" />
            )}
            <h3 className="text-[14px] font-semibold text-[#0e1a21]">
              {isComplete
                ? 'Qualification complète'
                : `${validatedCount}/${BLOCK_IDS.length} blocs validés`}
            </h3>
          </div>

          {isComplete ? (
            <div className="space-y-0.5 text-[12px] text-emerald-700">
              {leadSummary.destination && <p>Destination : {leadSummary.destination}</p>}
              {leadSummary.travelers && <p>Groupe : {leadSummary.travelers}</p>}
              {leadSummary.budget && <p>Budget : {leadSummary.budget}</p>}
            </div>
          ) : (
            <div className="space-y-0.5">
              <p className="text-[12px] text-[#6b7a85]">Blocs à compléter :</p>
              <p className="text-[12px] font-medium text-[#3a4a55]">
                {missingBlocks.join(' · ')}
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={!isComplete || finalizePending}
          onClick={handleFinalize}
          className={[
            'inline-flex shrink-0 items-center gap-2 rounded-[6px] px-4 py-2 text-[13px] font-semibold transition-colors',
            isComplete
              ? 'bg-[#15323f] text-white hover:bg-[#0e1a21] disabled:opacity-50'
              : 'cursor-not-allowed border border-[#e4e8eb] bg-white text-[#9aa7b0]',
          ].join(' ')}
        >
          {finalizePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Valider la qualification
        </button>
      </div>

      {/* Tout refaire */}
      {validatedCount > 0 && (
        <div className="mt-3 border-t border-[#e4e8eb]/60 pt-3">
          <button
            type="button"
            disabled={resetPending}
            onClick={handleReset}
            className={`inline-flex items-center gap-1.5 rounded-[6px] border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50 ${
              confirmReset
                ? 'border-[#c1411f] bg-[#fceee9] text-[#c1411f]'
                : 'border-[#e4e8eb] bg-white text-[#6b7a85] hover:bg-[#f6f7f8]'
            }`}
          >
            {resetPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            {confirmReset ? 'Confirmer — tout effacer ?' : 'Tout refaire'}
          </button>
          {confirmReset && (
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="ml-2 text-[12px] text-[#9aa7b0] hover:text-[#3a4a55]"
            >
              Annuler
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
