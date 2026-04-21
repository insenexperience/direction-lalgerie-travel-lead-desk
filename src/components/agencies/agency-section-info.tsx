import type { AgencyDetail } from "@/lib/agencies/types";
import { partnerAgencyTypeLabelFr } from "@/lib/mock-agencies";

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]">{label}</p>
      {value ? (
        <p className="mt-0.5 text-[13px] font-medium text-[#3a4a55]">{String(value)}</p>
      ) : (
        <p className="mt-0.5 text-[13px] italic text-[#9aa7b0]">Non renseigné</p>
      )}
    </div>
  );
}

interface AgencySectionInfoProps {
  agency: AgencyDetail;
}

export function AgencySectionInfo({ agency }: AgencySectionInfoProps) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
      <InfoRow label="Raison sociale" value={agency.legal_name} />
      <InfoRow label="Nom commercial" value={agency.trade_name} />
      <InfoRow label="Type" value={partnerAgencyTypeLabelFr[agency.type] ?? agency.type} />
      <InfoRow label="Statut" value={undefined} />
      <InfoRow label="Pays" value={agency.country} />
      <InfoRow label="Ville" value={agency.city} />
      {agency.website && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]">Site web</p>
          <a href={agency.website} target="_blank" rel="noopener noreferrer" className="mt-0.5 block text-[13px] font-medium text-[#1e5a8a] hover:underline">
            {agency.website}
          </a>
        </div>
      )}
      <InfoRow label="Destinations" value={agency.destinations} />
      <InfoRow label="Langues" value={agency.languages} />
      <InfoRow label="Segments" value={agency.segments} />
      <InfoRow label="SLA devis" value={agency.sla_quote_days ? `${agency.sla_quote_days} jours` : null} />
    </div>
  );
}
