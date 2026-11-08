"use client";

import Link from "next/link";
import { ArrowUp } from "lucide-react";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { chatOnDeskScope } from "@/app/(dashboard)/settings/assistant-actions";
import { DESK_SURFACES, normalizeDeskQuery, type DeskScope } from "@/lib/assistant/scope";
import type { AssistantTurn } from "@/lib/assistant/types";
import type { DeskView } from "@/lib/assistant/desk-data";
import { DeskReadout, type ReadoutFocus } from "./desk-readout";

export function DeskOverviewChat({ scope, turns, onTurns, onPin, onNewProject }: {
  scope: Exclude<DeskScope, { screen: "project" }>;
  turns: AssistantTurn[];
  onTurns: (turns: AssistantTurn[]) => void;
  onPin: (id: string) => void;
  onNewProject: () => void;
}) {
  const [value, setValue] = useState("");
  const [view, setView] = useState<DeskView | null>(null);
  const [focus, setFocus] = useState<ReadoutFocus>();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const composer = useRef<HTMLFormElement>(null);
  const history = useRef<HTMLDivElement>(null);
  const surface = DESK_SURFACES[scope.screen];

  useEffect(() => {
    const container = history.current;
    const target = container?.querySelector(".desk-assistant__message:last-child");
    if (container && target) container.scrollTop += target.getBoundingClientRect().top - container.getBoundingClientRect().top - 18;
  }, [turns, view]);

  function send(text: string) {
    if (!text.trim() || pending) return;
    const next = [...turns, { role: "user", content: text.trim() } satisfies AssistantTurn];
    setError("");
    start(async () => {
      try {
        const target: DeskScope = view?.project ? { screen: "project", leadId: view.project.id, tab: "trame" } : scope;
        const result = await chatOnDeskScope(target, next.slice(-9));
        if (!result.ok) { setError(result.error); return; }
        onTurns([...next, { role: "assistant", content: result.reply }]);
        setView(result.view);
        const query = normalizeDeskQuery(text);
        setFocus(/qualifi|precis|change/.test(query) ? "facts" : /histor|echanges|parcours/.test(query) ? "timeline" : /offres|propositions|devis/.test(query) ? "offers" : undefined);
        setValue("");
      } catch { setError("La demande n’a pas abouti. Réessaie dans un instant."); }
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(value);
  }

  return <div className="desk-assistant__conversation">
    <div className="desk-assistant__history" ref={history}>
      {!turns.length && <div className="desk-assistant__welcome">
        <h2>Que veux-tu faire avancer ?</h2>
        <p>Pose une question sur {surface.label.toLowerCase()} ou donne le nom d’un voyageur.</p>
        <div className="desk-assistant__suggestions">
          {surface.prompts.map(prompt => <button key={prompt} className="btn s sm" type="button" disabled={pending} onClick={() => send(prompt)}>{prompt}</button>)}
        </div>
      </div>}
      <div className="desk-assistant__messages" role="log" aria-label="Conversation">
        {turns.map(({ role, content }, index) => <div key={index} className="desk-assistant__message" data-role={role}>
          <b>{role === "user" ? "Vous" : "DA Sales"}</b><div>{content}</div>
        </div>)}
      </div>
      {view && <DeskReadout view={view} focus={focus} onPin={onPin} allowExport={["file", "projects", "pilot", "quotes"].includes(scope.screen)} />}
      {error && <p role="alert">{error}</p>}
      {pending && <p className="desk-assistant__pending" role="status">Consultation du Desk…</p>}
    </div>
    <form className="desk-assistant__input" ref={composer} onSubmit={submit}>
      <div className="desk-assistant__composer-actions">
        {(scope.screen === "file" || scope.screen === "projects") && <button className="btn s xs" type="button" onClick={onNewProject}>Nouveau projet</button>}
        {view?.project && <button className="btn s xs" type="button" onClick={() => { setView(null); onTurns([]); }}>Revenir à {surface.label.toLowerCase()}</button>}
        <Link className="desk-assistant__source" href={surface.href}>Ouvrir dans le Desk</Link>
      </div>
      <div className="desk-assistant__composer-field">
        <textarea aria-label="Votre message" className="inp" rows={2} value={value} maxLength={1600} placeholder="Écrire à DA Sales…" onChange={event => setValue(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); composer.current?.requestSubmit(); }
          }} />
        <button type="submit" className="desk-assistant__send" aria-label="Envoyer" disabled={pending || !value.trim()}><ArrowUp size={18} aria-hidden="true" /></button>
      </div>
    </form>
  </div>;
}
