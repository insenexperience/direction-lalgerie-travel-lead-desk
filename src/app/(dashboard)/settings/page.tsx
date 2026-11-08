import Link from "next/link";
import { Building2, Waypoints } from "lucide-react";
import { TopHeader } from "@/components/top-header";
import { AssistantConnection } from "@/components/assistant/assistant-connection";
import { contexteBo3 } from "@/lib/bo3/acces";
import { DESK_MAILBOX } from "@/lib/email/gmail-intake";
import { deskGmailConfiguration } from "@/lib/email/gmail-sync";

export default async function SettingsPage() {
  const context = await contexteBo3();
  const showGmail = context?.role === "admin" && !context.apercu;
  const config = deskGmailConfiguration();
  const gmail = showGmail && config === "configured"
    ? await context.supabase.from("desk_gmail_sync").select("synced_at,last_error").eq("id", true).maybeSingle()
    : null;
  const gmailLabel = config === "disabled" ? "Synchronisation désactivée"
    : config === "unconfigured" ? "Autorisation Google à configurer"
      : gmail?.error ? "État de synchronisation indisponible"
        : gmail?.data?.last_error === "history_expired" ? "Historique Gmail expiré. Une reprise est nécessaire."
          : gmail?.data?.last_error ? "Dernière synchronisation en échec"
            : gmail?.data ? "Synchronisation active" : "En attente de la première synchronisation";
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

      <section className="rounded-md border border-border bg-panel p-4 sm:p-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">DA Sales</h2>
        <AssistantConnection refresh />
      </section>
      {showGmail && <section className="rounded-md border border-border bg-panel p-4 sm:p-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Gmail du Desk</h2>
        <p>{DESK_MAILBOX} · Lecture seule</p>
        <p>{gmailLabel}</p>
        {gmail?.data?.synced_at && <p>Dernière synchronisation réussie · {new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "short", timeStyle: "short", timeZone: "Africa/Algiers",
        }).format(new Date(gmail.data.synced_at))}</p>}
      </section>}
    </div>
  );
}
