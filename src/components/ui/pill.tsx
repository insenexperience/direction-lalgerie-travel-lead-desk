import type { ReactNode } from "react";

type PillVariant = "neutral" | "revenue" | "hot" | "warn" | "info" | "steel";

const variantClasses: Record<PillVariant, string> = {
  neutral: "bg-[#f4f7fa] text-[#3a4a55] border-[#e4e8eb]",
  revenue: "bg-[#e6f4ee] text-[#0f6b4b] border-[#b8dece]",
  hot:     "bg-[#fceee9] text-[#c1411f] border-[#f5c9bc]",
  warn:    "bg-[#fdf3e2] text-[#a8710b] border-[#f0d49a]",
  info:    "bg-[#e8f0f9] text-[#1e5a8a] border-[#bdd3ee]",
  steel:   "bg-[#15323f] text-[#f3f7fa] border-transparent",
};

type PillProps = {
  variant?: PillVariant;
  dot?: boolean;
  children: ReactNode;
  className?: string;
};

export function Pill({ variant = "neutral", dot = false, children, className = "" }: PillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-0.5 text-[11px] font-medium leading-tight ${variantClasses[variant]} ${className}`}
    >
      {dot && (
        <span className="inline-block h-[5px] w-[5px] shrink-0 rounded-full bg-current opacity-70" aria-hidden />
      )}
      {children}
    </span>
  );
}
