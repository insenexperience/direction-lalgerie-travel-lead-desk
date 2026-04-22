import type { SupabaseLeadRow } from '@/lib/supabase-lead-row';
import { validatedBlocksCount, BLOCK_IDS } from '@/lib/qualification-blocks';
import { QUALIFICATION_BLOCKS_CONFIG } from './qualification-blocks-config';
import { QualificationStatusBar } from './qualification-status-bar';
import { QualificationProgress } from './qualification-progress';
import { QualificationBlock } from './qualification-block';
import { QualificationNarrative } from './qualification-narrative';
import { QualificationGate } from './qualification-gate';

interface Props {
  lead: SupabaseLeadRow;
}

export function LeadQualificationWorkspace({ lead }: Props) {
  const blocks = lead.qualification_blocks;

  return (
    <section className="space-y-4">
      <header className="space-y-0.5">
        <h2 className="font-display text-[18px] font-semibold text-[#0e1a21]">
          Qualification du voyage
        </h2>
        <p className="text-[12px] text-[#6b7a85]">
          Renseignez chaque bloc, puis validez pour passer à l&apos;assignation agence.
        </p>
      </header>

      <QualificationStatusBar
        validatedCount={validatedBlocksCount(blocks)}
        totalCount={BLOCK_IDS.length}
      />

      <QualificationProgress blocks={blocks} />

      <div className="space-y-3">
        {QUALIFICATION_BLOCKS_CONFIG.map(config => (
          <QualificationBlock
            key={config.id}
            leadId={lead.id}
            config={config}
            block={blocks[config.id]}
          />
        ))}
      </div>

      <QualificationNarrative
        leadId={lead.id}
        initialValue={lead.travel_desire_narrative ?? ''}
      />

      <QualificationGate
        leadId={lead.id}
        blocks={blocks}
        leadSummary={{
          destination: lead.destination_main,
          travelers: lead.travelers,
          budget: lead.budget,
        }}
      />
    </section>
  );
}
