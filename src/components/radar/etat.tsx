import { lienNotion, NOTION_RADAR_PAGE } from "@/lib/radar/bases";

/** Écran affiché quand le desk ne peut pas lire Notion : configuration manquante, accès refusé ou panne. */
export function EtatRadar({ raison, message }: { raison: "config" | "acces" | "erreur"; message: string }) {
  return (
    <div className="page">
      <div><div className="eyebrow">Veille et réseau</div><h1 className="t">Radar</h1><div className="sub">Signaux, acteurs, rendez-vous, partenariats et idées de Direction l&apos;Algérie, lus et écrits dans Notion.</div></div>
      {raison === "erreur" ? (
        <div className="card"><div className="empty"><b>Notion ne répond pas</b>{message}</div></div>
      ) : (
        <section className="card">
          <div className="card__hd"><span className="card__t">{raison === "config" ? "Brancher le radar sur Notion" : "Notion refuse l'accès"}</span><span className="tag amber">À faire une fois</span></div>
          <div className="card__bd stack">
            <div className="warn">{message}</div>
            <ol className="rd-etapes">
              <li>Dans Notion, ouvrir <b>Paramètres → Connexions → Développer ou gérer des intégrations</b> et créer une intégration interne « Travel Lead Desk ». Capacités : lire, mettre à jour et insérer du contenu, lire et insérer des commentaires, lire les informations des utilisateurs (sans adresse e-mail).</li>
              <li>Sur la page <a href={lienNotion(NOTION_RADAR_PAGE)} target="_blank" rel="noopener noreferrer"><b>Radar Direction l&apos;Algérie</b></a>, menu <b>⋯ → Connexions</b>, ajouter l&apos;intégration. Les cinq bases et la page de contexte de l&apos;agent en héritent.</li>
              <li>Dans Vercel, projet du desk, ajouter la variable <code>NOTION_TOKEN</code> (clé secrète de l&apos;intégration) en Preview et en Production, puis redéployer.</li>
            </ol>
            <div className="mt">La clé reste côté serveur : elle n&apos;est jamais envoyée au navigateur.</div>
          </div>
        </section>
      )}
    </div>
  );
}
