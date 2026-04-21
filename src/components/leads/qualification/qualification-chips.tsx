"use client";

import { Check, Sparkles } from 'lucide-react';

interface ChipOption {
  id: string;
  label: string;
}

interface QualificationChipsProps {
  options: ChipOption[];
  selected: string[];
  aiSuggested: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
  aiConfidence?: number | null;
}

export function QualificationChips({
  options,
  selected,
  aiSuggested,
  onToggle,
  disabled = false,
  aiConfidence,
}: QualificationChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(option => {
        const isSelected = selected.includes(option.id);
        const isAiSuggested = aiSuggested.includes(option.id);

        let chipClass = '';
        if (isSelected) {
          chipClass = 'bg-emerald-50 border-emerald-300 text-emerald-800';
        } else if (isAiSuggested) {
          chipClass = 'bg-violet-50 border-violet-300 text-violet-800';
        } else {
          chipClass = 'bg-white border-[#e4e8eb] text-[#3a4a55] hover:border-[#9aa7b0]';
        }

        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onToggle(option.id)}
            className={[
              'inline-flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1 text-[12px] font-medium transition-colors',
              chipClass,
              disabled ? 'cursor-default opacity-80' : 'cursor-pointer',
            ].join(' ')}
          >
            {isSelected && (
              <Check className="h-3 w-3 shrink-0" />
            )}
            {!isSelected && isAiSuggested && (
              <Sparkles className="h-3 w-3 shrink-0 text-violet-500" />
            )}
            {option.label}
            {isAiSuggested && !isSelected && aiConfidence != null && (
              <span className="ml-0.5 text-[10px] text-violet-400">
                {Math.round(aiConfidence * 100)}%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
