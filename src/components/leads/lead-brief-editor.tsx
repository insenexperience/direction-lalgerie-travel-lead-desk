"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { FileText, RefreshCw, Save } from "lucide-react";
import { generateAndSaveBrief, saveBriefEdit } from "@/app/(dashboard)/leads/actions";
import { useRouter } from "next/navigation";

type LeadBriefEditorProps = {
  leadId: string;
  generatedBrief: string | null;
  briefGeneratedAt: string | null;
  briefEditedAt: string | null;
};

const DEBOUNCE_MS = 1500;

export function LeadBriefEditor({
  leadId,
  generatedBrief,
  briefGeneratedAt,
  briefEditedAt,
}: LeadBriefEditorProps) {
  const router = useRouter();
  const [text, setText] = useState(generatedBrief ?? "");
  const [generating, startGenerate] = useTransition();
  const [saving, startSave] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(briefEditedAt ?? briefGeneratedAt);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(generatedBrief ?? "");
    setSavedAt(briefEditedAt ?? briefGeneratedAt);
  }, [generatedBrief, briefEditedAt, briefGeneratedAt]);

  function handleChange(value: string) {
    setText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startSave(async () => {
        const res = await saveBriefEdit(leadId, value);
        if (res.ok) {
          setSavedAt(new Date().toISOString());
          setError(null);
        } else {
          setError(res.error);
        }
      });
    }, DEBOUNCE_MS);
  }

  function handleGenerate() {
    setError(null);
    startGenerate(async () => {
      const res = await generateAndSaveBrief(leadId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const lastSaved = savedAt
    ? new Date(savedAt).toLocaleString("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" aria-hidden />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Brief agence
          </h4>
          {lastSaved ? (
            <span className="text-[10px] text-muted-foreground">
              — sauvegardé {lastSaved}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          disabled={generating}
          onClick={handleGenerate}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel-muted px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-panel disabled:opacity-45"
        >
          <RefreshCw
            className={["size-3.5", generating ? "animate-spin" : ""].join(" ")}
            aria-hidden
          />
          {generating ? "Génération…" : generatedBrief ? "Regénérer" : "Générer le brief"}
        </button>
      </div>

      {!generatedBrief && !generating ? (
        <p className="text-sm text-muted-foreground">
          Cliquez sur «&nbsp;Générer le brief&nbsp;» pour créer automatiquement le brief
          à partir des données de qualification.
        </p>
      ) : null}

      {generatedBrief || generating ? (
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            rows={16}
            placeholder="Le brief apparaîtra ici après génération…"
            className="w-full rounded-md border border-border bg-[var(--bg)] px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-steel/25 disabled:opacity-50"
            disabled={generating}
          />
          {saving ? (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-panel/80 px-1.5 py-0.5 text-[10px] text-muted-foreground backdrop-blur-sm">
              <Save className="size-3" aria-hidden />
              Sauvegarde…
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">{error}</p>
      ) : null}
    </div>
  );
}
