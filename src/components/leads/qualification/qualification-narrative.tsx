"use client";

import { useState, useRef, useTransition, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { saveQualificationFields } from '@/app/(dashboard)/leads/ai-actions';

interface QualificationNarrativeProps {
  leadId: string;
  initialValue: string;
}

export function QualificationNarrative({ leadId, initialValue }: QualificationNarrativeProps) {
  const [value, setValue] = useState(initialValue);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    setValue(next);
    setSaved(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        await saveQualificationFields(leadId, { travel_desire_narrative: next });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      });
    }, 1000);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9aa7b0]">
          Narration des désirs de voyage
        </p>
        {isPending && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#9aa7b0]" />
        )}
        {saved && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-600">
            <Check className="h-3 w-3" />
            Enregistré
          </span>
        )}
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        placeholder="Décrivez librement le projet de voyage en langage naturel — émotions, contexte, désirs profonds du voyageur…"
        rows={4}
        className="w-full rounded-[6px] border border-dashed border-[#e4e8eb] bg-[#f4f7fa] px-3 py-2.5 text-[13px] text-[#0e1a21] placeholder-[#9aa7b0] outline-none transition-colors focus:border-[#9aa7b0] focus:bg-white"
      />
    </div>
  );
}
