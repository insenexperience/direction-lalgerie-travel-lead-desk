import type { ReactNode } from "react";
import { Sparkline } from "@/components/ui/sparkline";

type KpiCardProps = {
  label: string;
  value: ReactNode;
  /** Pre-formatted delta string, e.g. "+12% vs. sem. dernière" */
  deltaText?: string;
  /** Delta sentiment — drives icon/colour */
  deltaUp?: boolean;
  /** Warn variant (amber) instead of up/down */
  deltaWarn?: boolean;
  href?: string;
  mono?: boolean;
  sparkData?: number[];
  sparkColor?: string;
};

export function KpiCard({
  label, value,
  deltaText, deltaUp, deltaWarn,
  href, mono = false, sparkData, sparkColor,
}: KpiCardProps) {

  const deltaColor = deltaWarn
    ? "text-[#a8710b]"
    : deltaUp === true
      ? "text-[#0f6b4b]"
      : deltaUp === false
        ? "text-[#c1411f]"
        : "text-[#6b7a85]";

  const card = (
    <div className="flex flex-col gap-2 rounded-[8px] border border-[#e4e8eb] bg-white p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#6b7a85]">{label}</p>
      <p className={`text-[28px] font-semibold leading-none text-[#0e1a21] ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </p>
      {deltaText && (
        <p className={`flex items-center gap-1 text-[12px] font-medium ${deltaColor}`}>
          {!deltaWarn && deltaUp === true  && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="18 15 12 9 6 15"/></svg>
          )}
          {!deltaWarn && deltaUp === false && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="6 9 12 15 18 9"/></svg>
          )}
          {deltaWarn && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          )}
          {deltaText}
        </p>
      )}
      {sparkData && sparkData.length > 1 && (
        <Sparkline data={sparkData} color={sparkColor ?? "#15323f"} className="mt-1 opacity-60" />
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block transition-opacity hover:opacity-80">
        {card}
      </a>
    );
  }

  return card;
}
