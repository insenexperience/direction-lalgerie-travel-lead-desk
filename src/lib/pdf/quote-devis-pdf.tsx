import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { DIRECTION_ALG_LOGO_URL } from "@/lib/brand-assets";
import type { QuoteItemLine } from "@/lib/quote-items-build";

export type QuoteDevisPdfData = {
  quoteId: string;
  createdAt: string;
  travelerName: string;
  travelerEmail: string;
  travelerPhone: string;
  tripSummary: string;
  workflowLabel: string;
  items: QuoteItemLine[];
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
  const ref = data.quoteId.replace(/-/g, "").slice(0, 12).toUpperCase();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.logoPlate}>
              <Image src={DIRECTION_ALG_LOGO_URL} style={styles.logoImg} />
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
