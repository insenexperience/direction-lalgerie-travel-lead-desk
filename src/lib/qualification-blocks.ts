export type BlockId = 'vibes' | 'group' | 'timing' | 'stay' | 'highlights' | 'budget';

export type BlockStatus = 'pending' | 'in_progress' | 'ready_for_review' | 'validated';

export type OpAction = 'confirmed' | 'adjusted' | 'manual' | null;

export interface QualificationBlock {
  ai_status: BlockStatus;
  ai_suggestions: string[];
  ai_confidence: number | null;
  ai_missing: string[];
  op_selections: string[] | null;
  op_action: OpAction;
  op_validated_at: string | null;
}

export interface QualificationBlocks {
  vibes: QualificationBlock;
  group: QualificationBlock;
  timing: QualificationBlock;
  stay: QualificationBlock;
  highlights: QualificationBlock;
  budget: QualificationBlock;
}

export const EMPTY_BLOCK: QualificationBlock = {
  ai_status: 'pending',
  ai_suggestions: [],
  ai_confidence: null,
  ai_missing: [],
  op_selections: null,
  op_action: null,
  op_validated_at: null,
};

export const EMPTY_QUALIFICATION_BLOCKS: QualificationBlocks = {
  vibes: { ...EMPTY_BLOCK },
  group: { ...EMPTY_BLOCK },
  timing: { ...EMPTY_BLOCK },
  stay: { ...EMPTY_BLOCK },
  highlights: { ...EMPTY_BLOCK },
  budget: { ...EMPTY_BLOCK },
};

export const BLOCK_IDS: BlockId[] = ['vibes', 'group', 'timing', 'stay', 'highlights', 'budget'];

export function allBlocksValidated(blocks: QualificationBlocks): boolean {
  return BLOCK_IDS.every(id => blocks[id].op_action !== null);
}

export function validatedBlocksCount(blocks: QualificationBlocks): number {
  return BLOCK_IDS.filter(id => blocks[id].op_action !== null).length;
}

export function blockIsReadyForReview(block: QualificationBlock): boolean {
  return block.ai_status === 'ready_for_review' && block.op_action === null;
}

export function safeQualificationBlocks(raw: unknown): QualificationBlocks {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const parsed: Partial<QualificationBlocks> = {};
    for (const id of BLOCK_IDS) {
      const block = obj[id];
      if (block && typeof block === 'object' && !Array.isArray(block)) {
        const b = block as Record<string, unknown>;
        parsed[id] = {
          ai_status: (b.ai_status as BlockStatus) ?? 'pending',
          ai_suggestions: Array.isArray(b.ai_suggestions) ? (b.ai_suggestions as string[]) : [],
          ai_confidence: typeof b.ai_confidence === 'number' ? b.ai_confidence : null,
          ai_missing: Array.isArray(b.ai_missing) ? (b.ai_missing as string[]) : [],
          op_selections: Array.isArray(b.op_selections) ? (b.op_selections as string[]) : null,
          op_action: (b.op_action as OpAction) ?? null,
          op_validated_at: typeof b.op_validated_at === 'string' ? b.op_validated_at : null,
        };
      } else {
        parsed[id] = { ...EMPTY_BLOCK };
      }
    }
    return parsed as QualificationBlocks;
  }
  return { ...EMPTY_QUALIFICATION_BLOCKS };
}
