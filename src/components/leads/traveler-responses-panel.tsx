import { MessageSquareText } from "lucide-react";
import {
  parseTravelerResponses,
  travelerResponseLines,
} from "@/lib/traveler-requalification";

type Props = {
  responses: Record<string, unknown> | null;
  submittedAt: string | null;
};

function formatDateFr(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function TravelerResponsesPanel({ responses, submittedAt }: Props) {
  if (!responses) return null;
  const r = parseTravelerResponses(responses);
  if (!r) return null;

  const lines = travelerResponseLines(r);

  return (
    <div className="mt-4">
      <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
        <MessageSquareText className="size-3 shrink-0" aria-hidden />
        Réponses voyageur
        {submittedAt ? (
          <span className="font-normal normal-case tracking-normal text-muted-foreground">
            · reçues le {formatDateFr(submittedAt)}
          </span>
        ) : null}
      </p>

      <dl className="mt-2 grid grid-cols-1 gap-3 rounded-md border border-border bg-panel-muted/40 p-3 sm:grid-cols-2">
        {lines.map((l) => (
          <div key={l.label} className={l.wide ? "sm:col-span-2" : undefined}>
            <dt className="text-[10px] text-muted-foreground">{l.label}</dt>
            <dd className="text-[12px] font-medium text-foreground">
              {l.value || "—"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
