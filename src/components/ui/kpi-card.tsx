import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

type KpiCardProps = {
  label: string;
  value: ReactNode;
  delta?: number;
  deltaLabel?: string;
  href?: string;
  mono?: boolean;
};

export function KpiCard({ label, value, delta, deltaLabel, href, mono = false }: KpiCardProps) {
  const deltaPositive = delta !== undefined && delta > 0;
  const deltaNegative = delta !== undefined && delta < 0;

  const card = (
    <div className="flex flex-col gap-2 rounded-[8px] border border-[#e4e8eb] bg-white p-5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[#6b7a85]">{label}</p>
      <p className={`text-[28px] font-semibold leading-none text-[#0e1a21] ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
      {delta !== undefined && (
        <div className="flex items-center gap-1">
          {deltaPositive && <TrendingUp className="h-3.5 w-3.5 text-[#0f6b4b]" aria-hidden />}
          {deltaNegative && <TrendingDown className="h-3.5 w-3.5 text-[#c1411f]" aria-hidden />}
          <span
            className={`text-[11px] font-medium ${
              deltaPositive ? "text-[#0f6b4b]" : deltaNegative ? "text-[#c1411f]" : "text-[#6b7a85]"
            }`}
          >
            {delta > 0 ? "+" : ""}{delta}{deltaLabel ? ` ${deltaLabel}` : ""}
          </span>
          <span className="text-[11px] text-[#9aa7b0]">vs. période préc.</span>
        </div>
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
