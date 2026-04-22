"use client";

import { PenLine } from 'lucide-react';

interface QualificationStatusBarProps {
  validatedCount: number;
  totalCount: number;
}

export function QualificationStatusBar({ validatedCount, totalCount }: QualificationStatusBarProps) {
  return (
    <div className="rounded-[8px] border border-[#e4e8eb] bg-[#f4f7fa] px-4 py-3">
      <div className="flex items-center gap-2">
        <PenLine className="h-4 w-4 text-[#6b7a85]" />
        <span className="text-[13px] font-medium text-[#0e1a21]">Saisie manuelle</span>
        <span className="text-[12px] text-[#6b7a85]">
          · {validatedCount}/{totalCount} blocs validés
        </span>
      </div>
    </div>
  );
}
