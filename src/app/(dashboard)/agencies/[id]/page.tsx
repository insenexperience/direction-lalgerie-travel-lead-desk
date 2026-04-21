import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getAgencyDetail, getAgencyRevenueChart } from "@/lib/agencies/queries";
import { AgencyDetailPage } from "@/components/agencies/agency-detail-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const agency = await getAgencyDetail(id);
  if (!agency) return { title: "Agence introuvable" };
  return { title: `${agency.trade_name ?? agency.legal_name} — Direction l'Algérie` };
}

export default async function AgencyDetailRoute({ params }: PageProps) {
  await connection();
  const { id } = await params;

  const [agency, revenueChart] = await Promise.all([
    getAgencyDetail(id),
    getAgencyRevenueChart(id),
  ]);

  if (!agency) notFound();

  return <AgencyDetailPage agency={agency} revenueChart={revenueChart} />;
}
