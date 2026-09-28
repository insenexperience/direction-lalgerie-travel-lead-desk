"use client";

// Erreur d'une page serveur (lecture Supabase refusée ou coupée, par exemple) : on le dit, plutôt que d'afficher
// des dossiers incomplets. Placée à la racine pour couvrir aussi la coque du back office, qui lit les dossiers.
import { useEffect } from "react";

export default function Erreur({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-100 px-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Les dossiers n’ont pas pu être chargés</h1>
        <p className="mt-2 max-w-md text-sm text-neutral-600">
          La base de données n’a pas répondu correctement. Rien n’a été modifié. Réessayez dans un instant ; si cela
          continue, notez l’heure et le code ci-dessous.
        </p>
        {error.digest ? <p className="mt-2 font-mono text-xs text-neutral-500">code : {error.digest}</p> : null}
      </div>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
      >
        Réessayer
      </button>
    </div>
  );
}
