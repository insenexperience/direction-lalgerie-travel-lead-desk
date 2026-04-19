import type { LucideIcon } from "lucide-react";

type PageEmptyProps = {
  Icon: LucideIcon;
  title: string;
};

export function PageEmpty({ Icon, title }: PageEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-panel-muted/30 px-6 py-20 text-center">
      <div className="flex size-14 items-center justify-center rounded-full border border-border bg-panel text-muted-foreground">
        <Icon className="size-7" strokeWidth={1.5} aria-hidden />
      </div>
      <p className="mt-5 font-display text-lg font-semibold tracking-tight text-foreground">
        {title}
      </p>
    </div>
  );
}
