"use client";

import { createContext, useCallback, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import { getAssistantStatus, setAssistantEnabled } from "@/app/(dashboard)/settings/assistant-actions";
import type { AssistantStatus } from "@/lib/assistant/types";

const ConnectionContext = createContext<{
  status: AssistantStatus | null;
  admin: boolean;
  pending: boolean;
  error: string | null;
  load: () => void;
  toggle: (enabled: boolean) => void;
} | null>(null);

const unavailable = "Les réglages de Claude sont momentanément indisponibles.";

export function AssistantConnectionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const load = useCallback(() => start(async () => {
    try {
      const result = await getAssistantStatus();
      if (!result.ok) { setError(result.error); return; }
      setStatus(result.status);
      setAdmin(result.admin);
      setError(null);
    } catch { setError(unavailable); }
  }), []);

  function toggle(enabled: boolean) {
    start(async () => {
      setError(null);
      try {
        const result = await setAssistantEnabled(enabled);
        if (result.ok) setStatus(result.status);
        else setError(result.error);
      } catch { setError(unavailable); }
    });
  }

  return <ConnectionContext.Provider value={{ status, admin, pending, error, load, toggle }}>{children}</ConnectionContext.Provider>;
}

export function useAssistantConnection() {
  return useContext(ConnectionContext);
}

const statusLabels = {
  disabled: "Désactivé",
  unconfigured: "À configurer",
  connected: "Connecté",
  unavailable: "Indisponible",
};

export function AssistantConnection({ refresh = false }: { refresh?: boolean }) {
  const connection = useAssistantConnection();
  const load = connection?.load;
  useEffect(() => { if (refresh) load?.(); }, [refresh, load]);
  if (!connection) return null;
  const { status, admin, pending, error, toggle } = connection;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div><b>Claude</b>{status ? <> · {statusLabels[status.state]}</> : pending ? " · Chargement…" : null}</div>
      {status?.state === "unconfigured" && admin && <p>Ajoutez <code>ANTHROPIC_API_KEY</code> aux secrets du serveur pour connecter Claude.</p>}
      {status?.state === "unavailable" && admin && <p>Vérifiez que la migration des réglages de l’assistant est appliquée.</p>}
      {status?.state === "connected" && <p>Claude utilise les éléments utiles du dossier ouvert pour aider à la qualification et à la préparation des brouillons.</p>}
      {status && !admin && status.state !== "connected" && <p>Un administrateur peut connecter l’assistant.</p>}
      {admin && status && (status.enabled || status.state === "disabled") && (
        <div><button type="button" className="btn s" disabled={pending} onClick={() => toggle(!status.enabled)}>
          {pending ? "Vérification…" : status.enabled ? "Désactiver Claude" : "Tester et activer Claude"}
        </button></div>
      )}
      {error && <p role="alert">{error}</p>}
      {(error || status?.state === "unavailable") && <div><button type="button" className="btn s" disabled={pending} onClick={load}>Actualiser l’état</button></div>}
    </div>
  );
}
