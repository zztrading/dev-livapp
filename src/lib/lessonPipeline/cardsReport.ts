/**
 * V5 Pipeline — Experience Cards Validation Report
 *
 * Validates each experienceCard against:
 *  1. cardType existence in the runtime registry (CARD_EFFECT_COMPONENTS)
 *  2. anchorText found in the section markdown (normalized search)
 *  3. duration within sane bounds (2..30s) when present
 *
 * Severity = warning. Never throws. Pipeline keeps going.
 */

import { CARD_EFFECT_COMPONENTS } from '@/components/lessons/card-effects';
import { anchorMatches } from '@/lib/v5/anchorMatch';

export type CardOrigin = 'inline' | 'root' | 'unknown';

export type CardIssueType =
  | 'unknown_type'
  | 'anchor_not_found'
  | 'duration_out_of_range'
  | 'missing_type';

export interface CardIssue {
  type: CardIssueType;
  message: string;
  suggestion?: string;
}

export interface CardReportEntry {
  index: number;
  cardId?: string;
  type?: string;
  anchorText?: string;
  duration?: number;
  origin: CardOrigin;
  valid: boolean;
  issues: CardIssue[];
}

export interface SectionReportEntry {
  sectionIndex: number;
  sectionId?: string;
  total: number;
  cards: CardReportEntry[];
}

export interface CardsReport {
  generatedAt: string;
  catalogSize: number;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    byOrigin: { inline: number; root: number; unknown: number };
    byIssueType: Record<CardIssueType, number>;
  };
  bySections: SectionReportEntry[];
  invalidCards: Array<CardReportEntry & { sectionIndex: number; sectionId?: string }>;
}

const DURATION_MIN = 2;
const DURATION_MAX = 30;

let _validTypesCache: Set<string> | null = null;
export function getValidCardTypes(): Set<string> {
  if (_validTypesCache) return _validTypesCache;
  _validTypesCache = new Set(Object.keys(CARD_EFFECT_COMPONENTS));
  return _validTypesCache;
}

// Normalização movida para src/lib/v5/anchorMatch.ts (source-of-truth único).

// Levenshtein up to maxDistance; returns Infinity if exceeded.
function levenshtein(a: string, b: string, maxDistance = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDistance) return Infinity;
  const m = a.length;
  const n = b.length;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDistance) return Infinity;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export function suggestSimilar(invalid: string, validSet: Set<string>): string | undefined {
  if (!invalid) return undefined;
  let best: string | undefined;
  let bestDist = 3; // accept up to distance 2
  for (const t of validSet) {
    const d = levenshtein(invalid, t, 2);
    if (d < bestDist) {
      bestDist = d;
      best = t;
      if (d === 1) break;
    }
  }
  return best;
}

export function validateCard(
  card: any,
  sectionMarkdown: string,
  validSet: Set<string>
): CardIssue[] {
  const issues: CardIssue[] = [];
  const type: string | undefined = card?.type;

  if (!type) {
    issues.push({ type: 'missing_type', message: 'Card sem campo "type"' });
  } else if (!validSet.has(type)) {
    const suggestion = suggestSimilar(type, validSet);
    issues.push({
      type: 'unknown_type',
      message: `Tipo "${type}" não existe no catálogo (CARD_EFFECT_COMPONENTS)`,
      suggestion: suggestion ? `Você quis dizer "${suggestion}"?` : undefined,
    });
  }

  const anchor: string | undefined = card?.anchorText;
  if (anchor && anchor.trim().length > 0) {
    if (!anchorMatches(sectionMarkdown || '', anchor)) {
      issues.push({
        type: 'anchor_not_found',
        message: `anchorText "${anchor}" não foi encontrado no markdown da seção`,
      });
    }
  }

  const duration = card?.duration ?? card?.props?.duration;
  if (typeof duration === 'number' && !Number.isNaN(duration)) {
    if (duration < DURATION_MIN || duration > DURATION_MAX) {
      issues.push({
        type: 'duration_out_of_range',
        message: `duration=${duration}s fora do intervalo [${DURATION_MIN}s..${DURATION_MAX}s]`,
      });
    }
  }

  return issues;
}

export function buildCardsReport(sections: any[] | undefined): CardsReport {
  const validSet = getValidCardTypes();
  const bySections: SectionReportEntry[] = [];
  const invalidCards: CardsReport['invalidCards'] = [];

  let total = 0;
  let valid = 0;
  let invalid = 0;
  const byOrigin = { inline: 0, root: 0, unknown: 0 };
  const byIssueType: Record<CardIssueType, number> = {
    unknown_type: 0,
    anchor_not_found: 0,
    duration_out_of_range: 0,
    missing_type: 0,
  };

  (sections || []).forEach((section: any, sIdx: number) => {
    const cards: any[] = section?.experienceCards || [];
    if (cards.length === 0) return;

    const sectionMarkdown: string =
      section?.visualContent || section?.markdown || section?.content || '';

    const entry: SectionReportEntry = {
      sectionIndex: sIdx,
      sectionId: section?.id,
      total: cards.length,
      cards: [],
    };

    cards.forEach((card: any, cIdx: number) => {
      const origin: CardOrigin = (card?._origin as CardOrigin) || 'unknown';
      byOrigin[origin] = (byOrigin[origin] ?? 0) + 1;
      const issues = validateCard(card, sectionMarkdown, validSet);
      issues.forEach((i) => {
        byIssueType[i.type] = (byIssueType[i.type] ?? 0) + 1;
      });
      const isValid = issues.length === 0;
      total += 1;
      if (isValid) valid += 1;
      else invalid += 1;

      const reportEntry: CardReportEntry = {
        index: cIdx,
        cardId: card?.id,
        type: card?.type,
        anchorText: card?.anchorText,
        duration: card?.duration ?? card?.props?.duration,
        origin,
        valid: isValid,
        issues,
      };

      entry.cards.push(reportEntry);
      if (!isValid) {
        invalidCards.push({
          ...reportEntry,
          sectionIndex: sIdx,
          sectionId: section?.id,
        });
      }
    });

    bySections.push(entry);
  });

  return {
    generatedAt: new Date().toISOString(),
    catalogSize: validSet.size,
    summary: { total, valid, invalid, byOrigin, byIssueType },
    bySections,
    invalidCards,
  };
}
