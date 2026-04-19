import Link from "next/link";
import { Building2, Settings, Waypoints } from "lucide-react";
import { TopHeader } from "@/components/top-header";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <TopHeader title="Réglages" description="Préférences compte et raccourcis vers la gestion des données." />

      <section className="rounded-md border border-border bg-panel p-4 sm:p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Gestion des données
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-foreground/85">
          Création, modification et suppression des leads et des agences partenaires se font depuis
          les écrans dédiés (actions destructives avec confirmation).
        </p>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          <li>
            <Link
              href="/leads"
              className="flex gap-3 rounded-md border border-border bg-panel-muted/40 p-4 transition-colors hover:border-[#182b35]/40 hover:bg-panel-muted"
            >
              <Waypoints className="mt-0.5 size-8 shrink-0 text-[#182b35]" aria-hidden />
              <div>
                <p className="font-semibold text-foreground">Leads</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Liste, Kanban, fiche détail — supprimer un dossier depuis la colonne Gestion ou la
                  zone sensible en bas de fiche.
                </p>
              </div>
            </Link>
          </li>
          <li>
            <Link
              href="/agencies"
              className="flex gap-3 rounded-md border border-border bg-panel-muted/40 p-4 transition-colors hover:border-[#182b35]/40 hover:bg-panel-muted"
            >
              <Building2 className="mt-0.5 size-8 shrink-0 text-[#182b35]" aria-hidden />
              <div>
                <p className="font-semibold text-foreground">Agences partenaires</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Annuaire Supabase — menu ⋮ sur chaque carte pour supprimer une agence.
                </p>
              </div>
            </Link>
          </li>
        </ul>
      </section>

      <section className="rounded-md border border-dashed border-border bg-panel-muted/30 px-4 py-8 text-center sm:px-6">
        <Settings className="mx-auto size-10 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-foreground">Autres paramètres</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Options avancées (notifications, intégrations) : à brancher.
        </p>
      </section>
    </div>
  );
}
