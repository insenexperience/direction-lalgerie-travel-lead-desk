import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  buildTravelerSummary,
  isTokenExpired,
} from "@/lib/traveler-requalification";
import { isUuid } from "@/lib/is-uuid";
import { BUDGETS_VOYAGEUR, champsDepuis } from "@/lib/bo3/champs-voyageur";
import { manqueDe } from "@/lib/bo3/projet";
import { GROUPES, MOIS, SOUPLESSES, trameDepuisSite, trameInterne, trameVide } from "@/lib/bo3/trame";
import { ChampsForm } from "./champs-form";
import { TravelerForm } from "./traveler-form";
import styles from "./traveler.module.css";

export const dynamic = "force-dynamic";

const LEAD_COLUMNS =
  "id, reference, traveler_name, trip_dates, travelers, travel_style, budget, trip_summary, public_token_expires_at, traveler_responses, traveler_responses_submitted_at, intake_payload, ai_qualification_payload, status, deleted_at";

type Brut = Record<string, unknown>;
/** Valeur de la trame reprise dans le formulaire seulement si elle fait partie de ses choix (le site écrit « Novembre »). */
const parmi = (v: string | null | undefined, liste: string[]) => liste.find((x) => x.toLowerCase() === (v ?? "").trim().toLowerCase()) ?? "";
const obj = (v: unknown): Brut => (v && typeof v === "object" && !Array.isArray(v) ? (v as Brut) : {});

function ExpiredScreen() {
  return (
    <main className={styles.root}>
      <div className={styles.expired}>
        <h1 className={styles.expiredTitle}>Ce lien n&apos;est plus actif</h1>
        <p className={styles.expiredText}>
          Pour reprendre votre projet de voyage, écrivez-nous — nous vous
          renverrons un lien personnel en quelques minutes.
        </p>
        <a className={styles.expiredLink} href="https://www.directionlalgerie.com">
          Direction l&apos;Algérie
        </a>
      </div>
    </main>
  );
}

export default async function TravelerPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ champs?: string | string[] }>;
}) {
  const { token } = await params;
  const champs = champsDepuis((await searchParams).champs);
  if (!isUuid(token)) return <ExpiredScreen />;

  const supabase = createServiceRoleClient();
  const { data: lead } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("public_token", token)
    .maybeSingle();

  // Lien expiré, ou dossier clos ou supprimé : plus de formulaire.
  if (!lead || isTokenExpired(lead.public_token_expires_at as string | null) || lead.deleted_at || lead.status === "won" || lead.status === "lost") {
    return <ExpiredScreen />;
  }

  const summary = buildTravelerSummary(lead as Record<string, unknown>);

  // Lien raccourci (refonte v3) : seulement ce qui manque à la trame. Même calcul que l'enregistrement
  // (api/q/[token]/champs) : une question déjà réglée entre-temps n'est plus posée, sa réponse serait ignorée.
  if (champs.length) {
    const trame =
      trameInterne(obj(lead.ai_qualification_payload).trame_v3) ??
      trameDepuisSite(obj(lead.intake_payload).trame);
    const manque = manqueDe(trame ?? trameVide());
    return (
      <ChampsForm
        token={token}
        champs={champs.filter((c) => manque.includes(c))}
        reference={summary.reference}
        prenom={String(lead.traveler_name ?? "").trim().split(/[\s&,]+/)[0] ?? ""}
        dejaEnvoye={Boolean(lead.traveler_responses_submitted_at)}
        initiaux={{
          mois: parmi(trame?.cadre.mois, MOIS),
          souplesse: parmi(trame?.cadre.souplesse, SOUPLESSES),
          groupe: parmi(trame?.groupe.type, GROUPES),
          nombre: trame?.groupe.nombre ?? null,
          enfants: trame?.groupe.enfants ?? null,
          budget: parmi(trame?.budget, BUDGETS_VOYAGEUR.map((b) => b.valeur)),
        }}
      />
    );
  }

  return (
    <TravelerForm
      token={token}
      summary={summary}
      alreadySubmitted={Boolean(lead.traveler_responses_submitted_at)}
      existingResponses={
        (lead.traveler_responses as Record<string, unknown> | null) ?? null
      }
    />
  );
}
