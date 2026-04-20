import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type ContextBannerVariant = "info" | "ia" | "operator" | "agency" | "warning";

const variantClass: Record<ContextBannerVariant, string> = {
  info: "border-sky-200/90 bg-sky-50/90 text-sky-950",
  ia: "border-sky-200/90 bg-sky-50/90 text-sky-950",
  operator: "border-amber-200/90 bg-amber-50/90 text-amber-950",
  agency: "border-border bg-panel-muted text-foreground",
  warning: "border-amber-200/90 bg-amber-50/90 text-amber-950",
};

type ContextBannerProps = {
  variant: ContextBannerVariant;
  title: string;
  children: ReactNode;
  icon?: LucideIcon;
  className?: string;
};

export function ContextBanner({
  variant,
  title,
  children,
  icon: Icon,
  className = "",
}: ContextBannerProps) {
  return (
    <div
      className={[
        "rounded-md border px-3 py-2.5 text-sm leading-snug",
        variantClass[variant],
        className,
      ].join(" ")}
      role="note"
    >
      <p className="flex items-start gap-2">
        {Icon ? (
          <Icon className="mt-0.5 size-4 shrink-0 opacity-90" aria-hidden />
        ) : null}
        <span className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-[0.08em] opacity-90">
            {title}
          </span>
          <span className="mt-1 block font-medium">{children}</span>
        </span>
      </p>
    </div>
  );
}
