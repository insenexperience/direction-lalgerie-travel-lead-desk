const labels = {
  desk: "Chargement du Travel Lead Desk…",
  inbox: "Chargement de la file de travail…",
  leads: "Chargement des projets…",
  detail: "Chargement du dossier…",
  dashboard: "Chargement du pilotage…",
} as const;

export function DeskLoading({ screen = "desk" }: { screen?: keyof typeof labels }) {
  const detail = screen === "detail";
  const dashboard = screen === "dashboard";

  return (
    <div className="page desk-loading">
      <p className="desk-loading__label" role="status">
        <span className="desk-loading__spinner" aria-hidden="true" />
        {labels[screen]}
      </p>
      <div aria-hidden="true" className="desk-loading__body">
        <div className="desk-loading__bar desk-loading__bar--title" />
        {(detail || dashboard) && (
          <div className="desk-loading__facts">
            {[0, 1, 2].map((n) => <div key={n} className="desk-loading__box"><div className="desk-loading__bar" /><div className="desk-loading__bar desk-loading__bar--short" /></div>)}
          </div>
        )}
        <div className="desk-loading__box">
          {Array.from({ length: detail ? 3 : 5 }, (_, n) => (
            <div key={n} className="desk-loading__row">
              <div className="desk-loading__bar" />
              <div className="desk-loading__bar desk-loading__bar--short" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
