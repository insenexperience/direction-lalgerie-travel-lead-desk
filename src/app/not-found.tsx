import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-100 px-4 text-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          404
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">
          Page introuvable
        </h1>
        <p className="mt-2 max-w-md text-sm text-neutral-600">
          L’URL n’existe pas, ou vous n’avez pas accès à ce dossier (RLS Supabase). Sur une
          fiche lead, seuls les UUID valides et visibles pour votre compte fonctionnent.
        </p>
      </div>
      <nav className="flex flex-wrap justify-center gap-3 text-sm font-semibold">
        <Link
          href="/"
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-neutral-800 hover:bg-neutral-50"
        >
          Accueil
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-neutral-800 hover:bg-neutral-50"
        >
          Connexion
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-neutral-800 hover:bg-neutral-50"
        >
          Tableau de bord
        </Link>
        <Link
          href="/leads"
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-neutral-800 hover:bg-neutral-50"
        >
          Leads
        </Link>
      </nav>
    </div>
  );
}
