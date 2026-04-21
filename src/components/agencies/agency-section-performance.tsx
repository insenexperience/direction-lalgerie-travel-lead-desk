import type { AgencyDetail } from "@/lib/agencies/types";

function formatRevenue(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)} k€`;
  return `${Math.round(n)} €`;
}

interface KpiMiniProps {
  label: string;
  value: string;
  sub?: string;
}

function KpiMini({ label, value, sub }: KpiMiniProps) {
  return (
    <div className="rounded-[8px] border border-[#e4e8eb] bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]">{label}</p>
      <p className="mt-1 font-mono text-[22px] font-semibold leading-none text-[#0e1a21]">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-[#6b7a85]">{sub}</p>}
    </div>
  );
}

interface AgencySectionPerformanceProps {
  agency: AgencyDetail;
  revenueChart: { label: string; value: number; isCurrent: boolean }[];
}

export function AgencySectionPerformance({ agency, revenueChart }: AgencySectionPerformanceProps) {
  const maxRevenue = Math.max(1, ...revenueChart.map((d) => d.value));
  const totalRevenue = revenueChart.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiMini
          label="Leads actifs"
          value={String(agency.metrics.leadsActive)}
        />
        <KpiMini
          label="Taux acceptation"
          value={`${agency.metrics.acceptanceRate} %`}
          sub={`${agency.metrics.consultationsAccepted}/${agency.metrics.consultationsTotal} (90j)`}
        />
        <KpiMini
          label="CA gagné 12m"
          value={formatRevenue(agency.metrics.revenueWon)}
        />
        <KpiMini
          label="SLA contractuel"
          value={`${agency.sla_quote_days}j`}
          sub="délai devis attendu"
        />
      </div>

      {/* Revenue bar chart */}
      <div className="rounded-[8px] border border-[#e4e8eb] bg-white p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-[13px] font-semibold text-[#0e1a21]">CA gagné — 12 derniers mois</h3>
          <span className="font-mono text-[12px] text-[#6b7a85]">{formatRevenue(totalRevenue)} total</span>
        </div>
        <div className="flex items-end gap-2" style={{ height: 100 }}>
          {revenueChart.map(({ label, value, isCurrent }) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-t-[3px] transition-all ${isCurrent ? "bg-[#15323f]" : "bg-[#e8f0f9]"}`}
                style={{ height: `${Math.max(2, (value / maxRevenue) * 80)}px` }}
                title={`${label} : ${formatRevenue(value)}`}
              />
              <span className="text-[10px] text-[#9aa7b0]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
