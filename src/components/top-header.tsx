import type { ReactNode } from "react";

type TopHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function TopHeader({ title, description, actions }: TopHeaderProps) {
  return (
    <header className="border-b border-border bg-panel px-4 py-4 sm:px-5 sm:py-5 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground sm:text-xs">
            Espace interne
          </p>
          <h2 className="font-display mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
