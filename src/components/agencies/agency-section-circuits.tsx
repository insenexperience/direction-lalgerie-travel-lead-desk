import type { AgencyDetail } from "@/lib/agencies/types";

interface AgencySectionCircuitsProps {
  agency: AgencyDetail;
}

export function AgencySectionCircuits({ agency }: AgencySectionCircuitsProps) {
  return (
    <div className="space-y-6">
      {/* Notes internes */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]">Notes internes</p>
        {agency.internal_notes ? (
          <div className="rounded-[8px] border border-[#e4e8eb] bg-white px-4 py-3">
            <p className="whitespace-pre-wrap text-[13px] text-[#3a4a55]">{agency.internal_notes}</p>
          </div>
        ) : (
          <p className="text-[13px] italic text-[#9aa7b0]">Aucune note interne.</p>
        )}
      </div>

      {/* Résumé capacités IA */}
      {agency.ai_capabilities_summary && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]">Résumé capacités (IA)</p>
          <div className="rounded-[8px] border border-[#e4e8eb] bg-[#f4f7fa]/50 px-4 py-3">
            <p className="whitespace-pre-wrap text-[13px] text-[#3a4a55]">{agency.ai_capabilities_summary}</p>
          </div>
        </div>
      )}

      {/* Circuits */}
      {agency.circuits_data && agency.circuits_data.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]">Circuits</p>
          <div className="rounded-[8px] border border-[#e4e8eb] bg-white px-4 py-3">
            <pre className="overflow-x-auto text-[12px] text-[#3a4a55]">
              {JSON.stringify(agency.circuits_data, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {!agency.internal_notes && !agency.ai_capabilities_summary && (!agency.circuits_data || agency.circuits_data.length === 0) && (
        <p className="text-[13px] italic text-[#9aa7b0]">Aucune donnée dans cette section.</p>
      )}
    </div>
  );
}
