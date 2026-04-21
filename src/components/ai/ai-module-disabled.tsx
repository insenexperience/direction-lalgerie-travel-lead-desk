"use client";

type AiModuleDisabledProps = {
  title: string;
  description?: string;
};

export function AiModuleDisabled({ title, description }: AiModuleDisabledProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-line bg-[var(--surface)] p-4 opacity-60">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-[var(--bg)]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 text-[var(--ink-3)]"
          aria-hidden="true"
        >
          {/* Sparkles with a diagonal slash */}
          <path d="M9.5 2l1.5 4 1.5-4" />
          <path d="M2 9.5l4 1.5-4 1.5" />
          <path d="M22 9.5l-4 1.5 4 1.5" />
          <path d="M12 14l1.5 4 1.5-4" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--ink-2)]">{title}</p>
        <p className="mt-0.5 text-xs text-[var(--ink-3)]">
          {description ?? "Module IA — Bientôt disponible"}
        </p>
      </div>
      <span className="shrink-0 rounded-full border border-line bg-[var(--bg)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--ink-3)]">
        Bientôt
      </span>
    </div>
  );
}
