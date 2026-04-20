"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type ChipProps = {
  href?: string;
  active?: boolean;
  count?: number;
  children: ReactNode;
  onClick?: () => void;
};

export function Chip({ href, active = false, count, children, onClick }: ChipProps) {
  const classes = [
    "inline-flex items-center gap-1.5 rounded-[6px] border px-3 py-1.5 text-[12px] font-medium transition-colors",
    active
      ? "border-[#15323f] bg-[#15323f] text-[#f3f7fa]"
      : "border-[#e4e8eb] bg-white text-[#3a4a55] hover:border-[#15323f]/30 hover:bg-[#f6f7f8]",
  ].join(" ");

  const inner = (
    <>
      {children}
      {count !== undefined && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
            active ? "bg-white/20 text-white" : "bg-[#e4e8eb] text-[#6b7a85]"
          }`}
        >
          {count}
        </span>
      )}
    </>
  );

  if (href) {
    return <Link href={href} className={classes}>{inner}</Link>;
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {inner}
    </button>
  );
}
