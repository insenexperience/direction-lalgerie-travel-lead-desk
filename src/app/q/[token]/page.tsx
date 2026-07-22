import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  buildTravelerSummary,
  isTokenExpired,
} from "@/lib/traveler-requalification";
import { isUuid } from "@/lib/is-uuid";
import { TravelerForm } from "./traveler-form";
import styles from "./traveler.module.css";

export const dynamic = "force-dynamic";

const LEAD_COLUMNS =
  "id, reference, traveler_name, trip_dates, travelers, travel_style, budget, trip_summary, public_token_expires_at, traveler_responses, traveler_responses_submitted_at";

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
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isUuid(token)) return <ExpiredScreen />;

  const supabase = createServiceRoleClient();
  const { data: lead } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("public_token", token)
    .maybeSingle();

  if (!lead || isTokenExpired(lead.public_token_expires_at as string | null)) {
    return <ExpiredScreen />;
  }

  const summary = buildTravelerSummary(lead as Record<string, unknown>);

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
