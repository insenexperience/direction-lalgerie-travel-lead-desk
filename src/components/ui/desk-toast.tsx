"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Tone = "success" | "error";
type Toast = { tone: Tone; message: string };
type DeskToast = Record<Tone, (message: string) => void>;

const ToastContext = createContext<DeskToast>({ success: () => {}, error: () => {} });

export const useDeskToast = () => useContext(ToastContext);

export function DeskToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [paused, setPaused] = useState(false);
  const [api] = useState<DeskToast>(() => ({
    success: (message) => setToast({ tone: "success", message }),
    error: (message) => setToast({ tone: "error", message }),
  }));

  useEffect(() => {
    if (!toast || toast.tone === "error" || paused) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast, paused]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className={toast ? `desk-toast desk-toast--${toast.tone}` : "desk-toast desk-toast--empty"}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        {toast && <span className="desk-toast__icon" aria-hidden="true">{toast.tone === "success" ? "✓" : "!"}</span>}
        <div className="desk-toast__message">
          <div role="status">{toast?.tone === "success" ? toast.message : null}</div>
          <div role="alert">{toast?.tone === "error" ? toast.message : null}</div>
        </div>
        {toast && <button type="button" aria-label="Fermer la notification" onClick={() => { setPaused(false); setToast(null); }}>×</button>}
      </div>
    </ToastContext.Provider>
  );
}
