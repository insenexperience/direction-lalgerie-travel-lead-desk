import { renderToBuffer } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { QuoteDevisPdfDocument, type PropositionPdf } from "@/lib/pdf/quote-devis-pdf";
import type { QuoteItemLine } from "@/lib/quote-items-build";
import { trameDepuisSite, trameInterne } from "@/lib/bo3/trame";
import {
  coerceQuoteWorkflowStatus,
  quoteWorkflowStatusLabelFr,
} from "@/lib/quote-workflow";

function parseItems(raw: unknown): QuoteItemLine[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: QuoteItemLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label : "";
    const detail = typeof o.detail === "string" ? o.detail : "";
    if (label || detail) out.push({ label: label || "—", detail: detail || "—" });
  }
  return out;
}

type Brut = Record<string, unknown>;
const obj = (v: unknown): Brut => (v && typeof v === "object" && !Array.isArray(v) ? (v as Brut) : {});
const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Proposition Direction l'Algérie (refonte v3) : `quotes.items` est alors un objet `{ v: 3, … }`, pas un tableau. */
function propositionV3(raw: unknown): Omit<PropositionPdf, "agence" | "details"> | null {
  const o = obj(raw);
  if (o.v !== 3) return null;
  return {
    titre: txt(o.titre),
    lignes: Array.isArray(o.lignes) ? o.lignes.map(txt).filter(Boolean) : [],
    prix: Number(o.prix) || 0,
    validite: Number(o.validite) || 15,
    note: txt(o.note),
    mention: o.mention === "visible" || o.mention === "aucune" ? o.mention : "discrete",
  };
}

/** Nom et ville de l'agence partenaire d'une proposition v3, pour la mention de partenariat. */
export async function agenceDeLaProposition(
  supabase: SupabaseClient,
  items: unknown,
): Promise<{ nom: string; ville: string } | null> {
  const id = txt(obj(items).agence_id);
  if (obj(items).v !== 3 || !id) return null;
  const { data } = await supabase
    .from("agencies")
    .select("legal_name, trade_name, city")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return { nom: txt(data.trade_name) || txt(data.legal_name), ville: txt(data.city) };
}

export type QuoteDevisPdfSource = {
  quote: {
    id: string;
    items: unknown;
    workflow_status: unknown;
    created_at: unknown;
  };
  lead: {
    id?: string;
    traveler_name: string;
    email: string;
    phone: string;
    trip_summary: string;
    reference?: string;
    intake_payload?: unknown;
    ai_qualification_payload?: unknown;
  };
  /** Agence partenaire d'une proposition v3 (voir agenceDeLaProposition). */
  agence?: { nom: string; ville: string } | null;
};

export async function buildQuoteDevisPdfBuffer(
  input: QuoteDevisPdfSource,
): Promise<Buffer> {
  const wf = coerceQuoteWorkflowStatus(input.quote.workflow_status);
  const created = new Date(String(input.quote.created_at ?? "")).toLocaleString(
    "fr-FR",
    { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Algiers" },
  );

  const v3 = propositionV3(input.quote.items);
  let proposition: PropositionPdf | undefined;
  if (v3) {
    const trame =
      trameInterne(obj(input.lead.ai_qualification_payload).trame_v3) ??
      trameDepuisSite(obj(input.lead.intake_payload).trame);
    const details = [
      trame?.groupe.nombre ? `${trame.groupe.nombre} pers.` : "",
      trame?.cadre.mois ?? "",
    ].filter(Boolean);
    proposition = { ...v3, agence: input.agence ?? null, details };
  }
  const items = v3 ? [] : parseItems(input.quote.items);

  return renderToBuffer(
    <QuoteDevisPdfDocument
      data={{
        quoteId: String(input.quote.id),
        reference:
          input.lead.reference?.trim() ||
          (input.lead.id ? `DA-${input.lead.id.slice(0, 8).toUpperCase()}` : ""),
        createdAt: created,
        travelerName: input.lead.traveler_name,
        travelerEmail: input.lead.email,
        travelerPhone: input.lead.phone,
        tripSummary: input.lead.trip_summary,
        workflowLabel: quoteWorkflowStatusLabelFr[wf],
        proposition,
        items: items.length || v3
          ? items
          : [
              {
                label: "Contenu",
                detail:
                  "— (aucune ligne structurée — complétez le devis ou régénérez depuis la proposition)",
              },
            ],
      }}
    />,
  );
}
