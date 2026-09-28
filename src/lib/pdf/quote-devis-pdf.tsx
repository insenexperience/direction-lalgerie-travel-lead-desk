import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { LOGO_DA_PDF } from "@/lib/pdf/logo-da";
import type { QuoteItemLine } from "@/lib/quote-items-build";
import type { Mention } from "@/lib/bo3/types";

/** Proposition Direction l'Algérie issue de la conversion d'un devis agence (refonte v3). */
export type PropositionPdf = {
  titre: string;
  lignes: string[];
  prix: number;
  validite: number;
  note: string;
  mention: Mention;
  agence: { nom: string; ville: string } | null;
  /** « 4 pers. », « octobre » : repris de la trame quand elle les contient. */
  details: string[];
};

export type QuoteDevisPdfData = {
  quoteId: string;
  /** Référence du dossier (leads.reference), vide pour les anciens devis. */
  reference: string;
  createdAt: string;
  travelerName: string;
  travelerEmail: string;
  travelerPhone: string;
  tripSummary: string;
  workflowLabel: string;
  items: QuoteItemLine[];
  proposition?: PropositionPdf;
};

const ink = "#0f1720";
const muted = "#475569";
const brand = "#182b35";
const brandLight = "#f3f7fa";

/** Fond bleu-vert semi-transparent pour faire ressortir le logo blanc. */
const logoPlateBg = "rgba(18, 110, 102, 0.42)";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: ink,
  },
  header: {
    backgroundColor: brand,
    color: brandLight,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  logoPlate: {
    backgroundColor: logoPlateBg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  logoImg: {
    height: 34,
    width: 118,
    objectFit: "contain",
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  brandLine: { fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", opacity: 0.9 },
  title: { marginTop: 6, fontSize: 18, fontWeight: "bold" },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 10,
  },
  metaCol: { width: "48%" },
  metaLabel: { fontSize: 8, color: muted, textTransform: "uppercase", marginBottom: 3 },
  metaValue: { fontSize: 10 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: brand,
    marginTop: 14,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  thLeft: { width: "28%", fontSize: 8, fontWeight: "bold", color: muted, textTransform: "uppercase" },
  thRight: { width: "72%", fontSize: 8, fontWeight: "bold", color: muted, textTransform: "uppercase" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  cellLabel: { width: "28%", fontSize: 9, fontWeight: "bold", paddingRight: 6 },
  cellDetail: { width: "72%", fontSize: 9, lineHeight: 1.35 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    fontSize: 8,
    color: muted,
    borderTopWidth: 0.5,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
  },
  badge: {
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: "#e0f2fe",
    color: "#075985",
    paddingVertical: 3,
    paddingHorizontal: 8,
    fontSize: 8,
    fontWeight: "bold",
  },
});

export function QuoteDevisPdfDocument({ data }: { data: QuoteDevisPdfData }) {
  if (data.proposition) return <PropositionDocument data={data} p={data.proposition} />;
  const ref = data.quoteId.replace(/-/g, "").slice(0, 12).toUpperCase();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.logoPlate}>
              <Image src={LOGO_DA_PDF} style={styles.logoImg} />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.brandLine}>
                {"Direction l'Algérie"}
              </Text>
              <Text style={styles.title}>Devis voyage</Text>
            </View>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Référence devis</Text>
            <Text style={styles.metaValue}>DEV-{ref}</Text>
            <Text style={styles.badge}>Statut : {data.workflowLabel}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>{"Date d'émission"}</Text>
            <Text style={styles.metaValue}>{data.createdAt}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Voyageur</Text>
        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Nom</Text>
            <Text style={styles.metaValue}>{data.travelerName}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Contact</Text>
            <Text style={styles.metaValue}>{data.travelerEmail || "—"}</Text>
            <Text style={styles.metaValue}>{data.travelerPhone || ""}</Text>
          </View>
        </View>

        {data.tripSummary.trim() ? (
          <>
            <Text style={styles.sectionTitle}>Contexte</Text>
            <Text style={{ fontSize: 9, lineHeight: 1.4, marginBottom: 12 }}>{data.tripSummary}</Text>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Détail du projet</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.thLeft}>Rubrique</Text>
          <Text style={styles.thRight}>Description</Text>
        </View>
        {data.items.map((it, i) => (
          <View key={i} style={styles.row} wrap={false}>
            <Text style={styles.cellLabel}>{it.label}</Text>
            <Text style={styles.cellDetail}>{it.detail}</Text>
          </View>
        ))}

        <Text style={{ marginTop: 16, fontSize: 9, color: muted, lineHeight: 1.4 }}>
          {
            "Montants, taxes, conditions générales et modalités de paiement : à compléter avant envoi définitif. Document émis par Direction l'Algérie pour le voyageur concerné."
          }
        </Text>

        <View style={styles.footer} fixed>
          <Text>
            {
              "Direction l'Algérie — document à usage du voyageur. Ne pas reproduire sans autorisation."
            }
          </Text>
        </View>
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------- proposition v3

/** Les polices intégrées du PDF ne connaissent pas l'espace fine insécable de fr-FR. */
const euros = (n: number) => `${n.toLocaleString("fr-FR").replace(/\s/g, " ")} €`;

const prop = StyleSheet.create({
  titre: { fontFamily: "Times-Roman", fontSize: 24, color: brand, lineHeight: 1.15 },
  sousTitre: { marginTop: 6, fontSize: 9.5, color: muted },
  emise: { marginTop: 2, fontSize: 8.5, color: muted },
  intro: { marginTop: 22, marginBottom: 6 },
  ligne: {
    flexDirection: "row",
    paddingVertical: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
  },
  puce: { width: 12, color: brand, fontSize: 10 },
  ligneTexte: { flex: 1, fontSize: 10, lineHeight: 1.4 },
  note: { marginTop: 12, fontFamily: "Times-Italic", fontSize: 11, color: ink, lineHeight: 1.4 },
  prix: {
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    backgroundColor: brandLight,
    borderLeftWidth: 3,
    borderLeftColor: brand,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  prixLabel: { fontSize: 8, color: muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  prixValeur: { fontSize: 20, fontWeight: "bold", color: brand },
  conditions: { fontSize: 9, color: muted, textAlign: "right", lineHeight: 1.5 },
  partenariat: {
    marginTop: 22,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#cbd5e1",
    fontSize: 9,
    color: muted,
    lineHeight: 1.45,
  },
  gras: { fontWeight: "bold", color: ink },
  piedLigne: { flexDirection: "row", justifyContent: "space-between" },
});

function PropositionDocument({ data, p }: { data: QuoteDevisPdfData; p: PropositionPdf }) {
  const numero = data.reference || `P-${data.quoteId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const sousTitre = [`Proposition n° ${numero}`, `pour ${data.travelerName}`, ...p.details].join(" · ");
  const ag = p.mention === "aucune" ? null : p.agence;

  return (
    <Document title={`${p.titre} — Direction l'Algérie`} author="Direction l'Algérie">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.logoPlate}>
              <Image src={LOGO_DA_PDF} style={styles.logoImg} />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.brandLine}>{"Direction l'Algérie"}</Text>
              <Text style={styles.title}>Proposition de voyage</Text>
            </View>
          </View>
        </View>

        <Text style={prop.titre}>{p.titre}</Text>
        <Text style={prop.sousTitre}>{sousTitre}</Text>
        <Text style={prop.emise}>Émise le {data.createdAt}</Text>

        {p.lignes.length ? (
          <>
            <Text style={[styles.sectionTitle, prop.intro]}>Ce que comprend la proposition</Text>
            {p.lignes.map((l, i) => (
              <View key={i} style={prop.ligne} wrap={false}>
                <Text style={prop.puce}>–</Text>
                <Text style={prop.ligneTexte}>{l}</Text>
              </View>
            ))}
          </>
        ) : null}

        {p.note ? <Text style={prop.note}>{p.note}</Text> : null}

        <View style={prop.prix} wrap={false}>
          <View>
            <Text style={prop.prixLabel}>Prix par personne</Text>
            <Text style={prop.prixValeur}>{p.prix > 0 ? euros(p.prix) : "—"}</Text>
          </View>
          <View>
            <Text style={prop.conditions}>Valable {p.validite} jours</Text>
            <Text style={prop.conditions}>Paiement hors plateforme</Text>
          </View>
        </View>

        {ag ? (
          <Text style={prop.partenariat}>
            {p.mention === "visible" ? (
              <>
                <Text style={prop.gras}>Réalisé en partenariat avec {ag.nom}</Text>
                {ag.ville ? `, agence réceptive à ${ag.ville}.` : ", agence réceptive partenaire."}
                {" Direction l'Algérie reste votre interlocuteur unique."}
              </>
            ) : (
              `Proposition Direction l'Algérie, construite avec ${ag.nom}${ag.ville ? ` (${ag.ville})` : ""}, agence réceptive partenaire. Votre interlocuteur reste Direction l'Algérie.`
            )}
          </Text>
        ) : null}

        <View style={styles.footer} fixed>
          <View style={prop.piedLigne}>
            <Text>{"Direction l'Algérie · www.directionlalgerie.com"}</Text>
            <Text>Proposition n° {numero}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
