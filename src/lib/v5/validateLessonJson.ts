/**
 * Validador prévio do JSON de aula V5 — antes de mandar pro pipeline.
 *
 * Usa a MESMA fonte de verdade que o runtime (isValidCardEffectType)
 * pra garantir que não há divergência: se passar aqui, renderiza lá.
 */

import { isValidCardEffectType, CARD_EFFECT_TYPES } from '@/components/lessons/card-effects';
import { ACTIVE_TRACKS } from './buildGptKit';
import { anchorMatches } from './anchorMatch';
import { validateExercise } from '@/lib/exerciseValidator';
import { normalizeExerciseForPipeline } from '@/lib/lessonPipeline/exerciseNormalization';

export interface ValidationError {
  path: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  parsed?: any;
}

const VALID_EXERCISE_TYPES = new Set([
  'multiple-choice',
  'true-false',
  'fill-in-blanks',
  'scenario-selection',
  'data-collection',
]);

/**
 * Card-effect types que são "data-driven" — exigem `props` completas
 * (title, subtitle, chapters[3], icon, colorScheme) no JSON da aula.
 *
 * Sem props válidas, o componente cai num fallback hardcoded genérico
 * que NÃO reflete o conteúdo da aula. Por isso o validador bloqueia
 * a publicação quando faltarem.
 *
 * Contrato: docs/contracts/CARD-EFFECTS-DATA-DRIVEN-CONTRACT.md
 */
const DATA_DRIVEN_CARD_TYPES = new Set([
  'strategic-shift',
  'problem-identifier',
  'profit-calculator',
  'automation',
  'human-check',
]);

const VALID_COLOR_SCHEMES = new Set([
  'purple',
  'violet',
  'indigo',
  'blue',
  'orange',
  'gold',
  'green',
]);

/**
 * Valida `props` de um card data-driven. Retorna lista de erros (vazia se OK).
 * Os erros vão como ERROS BLOQUEANTES, não warnings — sem props válidas o
 * card renderiza conteúdo desconectado da narração.
 */
function validateDataDrivenCardProps(
  card: any,
  cardPath: string
): ValidationError[] {
  const errs: ValidationError[] = [];
  const type = typeof card.type === 'string' ? card.type.toLowerCase().trim() : '';
  if (!DATA_DRIVEN_CARD_TYPES.has(type)) return errs;

  const props = card.props;
  if (!props || typeof props !== 'object') {
    errs.push({
      path: `${cardPath}.props`,
      message: `Card "${type}" exige bloco "props" (title, subtitle, chapters[3], icon, colorScheme). Sem isso o card renderiza conteúdo hardcoded desconectado da aula.`,
      suggestion:
        '"props": { "title": "...", "subtitle": "...", "chapters": ["...", "...", "..."], "icon": "sparkles", "colorScheme": "purple" }',
    });
    return errs;
  }

  if (typeof props.title !== 'string' || props.title.trim().length === 0) {
    errs.push({
      path: `${cardPath}.props.title`,
      message: `Card "${type}": props.title obrigatório (string não-vazia).`,
    });
  }
  if (
    !Array.isArray(props.chapters) ||
    props.chapters.length < 3 ||
    !props.chapters.every(
      (c: unknown) => typeof c === 'string' && c.trim().length > 0
    )
  ) {
    errs.push({
      path: `${cardPath}.props.chapters`,
      message: `Card "${type}": props.chapters obrigatório (array com pelo menos 3 strings não-vazias).`,
    });
  }
  if (props.subtitle !== undefined && typeof props.subtitle !== 'string') {
    errs.push({
      path: `${cardPath}.props.subtitle`,
      message: `Card "${type}": props.subtitle, se presente, deve ser string.`,
    });
  }
  if (typeof props.icon !== 'string' || props.icon.trim().length === 0) {
    errs.push({
      path: `${cardPath}.props.icon`,
      message: `Card "${type}": props.icon obrigatório (string).`,
      suggestion:
        'Use um nome Lucide reconhecido: sparkles, zap, star, rocket, book, target, trending-up, shield, brain, cog, compass, users.',
    });
  }
  if (
    typeof props.colorScheme !== 'string' ||
    !VALID_COLOR_SCHEMES.has(props.colorScheme.toLowerCase().trim())
  ) {
    errs.push({
      path: `${cardPath}.props.colorScheme`,
      message: `Card "${type}": props.colorScheme obrigatório.`,
      suggestion: `Valores aceitos: ${Array.from(VALID_COLOR_SCHEMES).join(', ')}.`,
    });
  }
  return errs;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Levenshtein simples — pra sugerir tipo de card mais próximo quando errado
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function suggestCardType(badType: string): string | undefined {
  const lower = badType.toLowerCase().trim();
  let best: { type: string; dist: number } | null = null;
  for (const t of CARD_EFFECT_TYPES) {
    const d = levenshtein(lower, t);
    if (best === null || d < best.dist) best = { type: t, dist: d };
  }
  // só sugere se a distância for razoável (até 1/3 do tamanho do nome)
  if (best && best.dist <= Math.max(2, Math.floor(lower.length / 3))) {
    return best.type;
  }
  return undefined;
}

export function validateLessonJson(jsonStr: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // 1) Parse
  let data: any;
  try {
    data = JSON.parse(jsonStr);
  } catch (e: any) {
    return {
      valid: false,
      errors: [{ path: '(root)', message: `JSON inválido: ${e.message}` }],
      warnings: [],
    };
  }

  // 1.b) Aceitar tanto objeto quanto array com 1 elemento (formato comum do GPT)
  if (Array.isArray(data)) {
    if (data.length !== 1) {
      errors.push({
        path: '(root)',
        message: `Esperado 1 objeto de aula, recebido array com ${data.length} itens.`,
      });
      return { valid: false, errors, warnings };
    }
    data = data[0];
  }

  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: [{ path: '(root)', message: 'JSON não é um objeto.' }],
      warnings: [],
    };
  }

  // 2) Campos top-level
  if (data.model !== 'v5') {
    errors.push({
      path: 'model',
      message: `Esperado "v5", recebido "${data.model}".`,
    });
  }
  if (typeof data.title !== 'string' || data.title.length < 3) {
    errors.push({
      path: 'title',
      message: 'title obrigatório (string com ≥ 3 chars).',
    });
  }
  if (typeof data.trackId !== 'string' || !UUID_RE.test(data.trackId)) {
    errors.push({
      path: 'trackId',
      message: `trackId deve ser UUID válido. Trilhas ativas: ${ACTIVE_TRACKS.map(
        (t) => `${t.name} (${t.id})`
      ).join(', ')}`,
    });
  } else {
    const known = ACTIVE_TRACKS.find((t) => t.id === data.trackId);
    if (!known) {
      warnings.push({
        path: 'trackId',
        message: `trackId "${data.trackId}" não pertence a uma trilha ativa conhecida. Verifique se é intencional.`,
      });
    }
  }
  if (typeof data.trackName !== 'string') {
    errors.push({ path: 'trackName', message: 'trackName obrigatório.' });
  }
  if (typeof data.orderIndex !== 'number' || data.orderIndex < 1) {
    errors.push({
      path: 'orderIndex',
      message: 'orderIndex deve ser inteiro positivo.',
    });
  }

  // 3) Sections
  if (!Array.isArray(data.sections) || data.sections.length === 0) {
    errors.push({ path: 'sections', message: 'sections deve ser array não-vazio.' });
  } else {
    let totalCards = 0;
    data.sections.forEach((sec: any, i: number) => {
      const path = `sections[${i}]`;
      if (typeof sec.id !== 'string') {
        errors.push({ path: `${path}.id`, message: 'id obrigatório (string).' });
      }
      if (typeof sec.visualContent !== 'string' || sec.visualContent.length < 10) {
        errors.push({
          path: `${path}.visualContent`,
          message: 'visualContent obrigatório (≥ 10 chars).',
        });
      }
      if (sec.speechBubbleText !== undefined) {
        if (typeof sec.speechBubbleText !== 'string') {
          errors.push({
            path: `${path}.speechBubbleText`,
            message: 'speechBubbleText deve ser string.',
          });
        } else if (sec.speechBubbleText.length > 60) {
          errors.push({
            path: `${path}.speechBubbleText`,
            message: `speechBubbleText tem ${sec.speechBubbleText.length} chars (máx 60).`,
          });
        }
      }

      // Experience cards
      if (sec.experienceCards !== undefined) {
        if (!Array.isArray(sec.experienceCards)) {
          errors.push({
            path: `${path}.experienceCards`,
            message: 'experienceCards deve ser array.',
          });
        } else {
          sec.experienceCards.forEach((card: any, ci: number) => {
            const cardPath = `${path}.experienceCards[${ci}]`;
            totalCards++;
            if (typeof card.type !== 'string') {
              errors.push({
                path: `${cardPath}.type`,
                message: 'type obrigatório (string).',
              });
            } else if (!isValidCardEffectType(card.type)) {
              const suggestion = suggestCardType(card.type);
              errors.push({
                path: `${cardPath}.type`,
                message: `type "${card.type}" não existe no catálogo.`,
                suggestion,
              });
            }
            // Bloqueio de cards data-driven sem props completas
            errors.push(...validateDataDrivenCardProps(card, cardPath));
            if (typeof card.anchorText !== 'string' || card.anchorText.length < 3) {
              warnings.push({
                path: `${cardPath}.anchorText`,
                message:
                  'anchorText recomendado (trecho literal do visualContent).',
              });
            } else if (
              typeof sec.visualContent === 'string' &&
              !anchorMatches(sec.visualContent, card.anchorText)
            ) {
              warnings.push({
                path: `${cardPath}.anchorText`,
                message: `anchorText "${card.anchorText}" não encontrado no visualContent da seção.`,
              });
            }
          });
        }
      }
    });

    // 3.b) Experience cards no NÍVEL RAIZ (formato AdminV5CardConfig + Custom GPT).
    // O runtime (GuidedLessonV5) e o pipeline (step1-intake) já suportam esse formato:
    // cards no root com `sectionIndex` 1-based são redistribuídos para a seção apontada.
    // Aqui replicamos a mesma semântica para que a contagem prévia bata com o pipeline.
    let lastSectionHasRootCards = false;
    if (data.experienceCards !== undefined) {
      if (!Array.isArray(data.experienceCards)) {
        errors.push({
          path: 'experienceCards',
          message: 'experienceCards (root) deve ser array.',
        });
      } else {
        const totalSections = data.sections.length;
        data.experienceCards.forEach((card: any, ci: number) => {
          const cardPath = `experienceCards[${ci}]`;
          totalCards++;

          if (typeof card.type !== 'string') {
            errors.push({
              path: `${cardPath}.type`,
              message: 'type obrigatório (string).',
            });
          } else if (!isValidCardEffectType(card.type)) {
            const suggestion = suggestCardType(card.type);
            errors.push({
              path: `${cardPath}.type`,
              message: `type "${card.type}" não existe no catálogo.`,
              suggestion,
            });
          }

          // Bloqueio de cards data-driven sem props completas
          errors.push(...validateDataDrivenCardProps(card, cardPath));

          if (typeof card.sectionIndex !== 'number') {
            errors.push({
              path: `${cardPath}.sectionIndex`,
              message:
                'sectionIndex obrigatório (number, 1-based) para cards no nível raiz.',
            });
          } else if (
            !Number.isInteger(card.sectionIndex) ||
            card.sectionIndex < 1 ||
            card.sectionIndex > totalSections
          ) {
            errors.push({
              path: `${cardPath}.sectionIndex`,
              message: `sectionIndex ${card.sectionIndex} fora do range válido (1..${totalSections}).`,
            });
          } else {
            const targetSection = data.sections[card.sectionIndex - 1];
            if (card.sectionIndex === totalSections) {
              lastSectionHasRootCards = true;
            }
            if (typeof card.anchorText !== 'string' || card.anchorText.length < 3) {
              warnings.push({
                path: `${cardPath}.anchorText`,
                message:
                  'anchorText recomendado (trecho literal do visualContent da seção apontada).',
              });
            } else if (
              targetSection &&
              typeof targetSection.visualContent === 'string' &&
              !anchorMatches(targetSection.visualContent, card.anchorText)
            ) {
              warnings.push({
                path: `${cardPath}.anchorText`,
                message: `anchorText "${card.anchorText}" não encontrado no visualContent da seção ${card.sectionIndex}.`,
              });
            }
          }
        });
      }
    }

    // Última seção sem cards (recomendação) — considera inline E root
    const lastIdx = data.sections.length - 1;
    const last = data.sections[lastIdx];
    const lastInlineHasCards =
      Array.isArray(last?.experienceCards) && last.experienceCards.length > 0;
    if (lastInlineHasCards || lastSectionHasRootCards) {
      warnings.push({
        path: lastInlineHasCards ? `sections[${lastIdx}]` : 'experienceCards',
        message:
          'Última seção (fechamento) normalmente não deve ter experience cards.',
      });
    }

    if (totalCards < 3 || totalCards > 5) {
      warnings.push({
        path: 'sections',
        message: `Total de ${totalCards} experience cards. Recomendado: 3 a 5.`,
      });
    }
  }

  // 4) Exercises
  if (!Array.isArray(data.exercises) || data.exercises.length === 0) {
    errors.push({ path: 'exercises', message: 'exercises deve ser array não-vazio.' });
  } else {
    if (data.exercises.length < 4 || data.exercises.length > 6) {
      warnings.push({
        path: 'exercises',
        message: `${data.exercises.length} exercises. Recomendado: 4 a 6.`,
      });
    }
    data.exercises.forEach((ex: any, i: number) => {
      const path = `exercises[${i}]`;
      if (typeof ex.type !== 'string') {
        errors.push({ path: `${path}.type`, message: 'type obrigatório.' });
      } else if (!VALID_EXERCISE_TYPES.has(ex.type)) {
        errors.push({
          path: `${path}.type`,
          message: `type "${ex.type}" inválido. Válidos: ${[...VALID_EXERCISE_TYPES].join(', ')}.`,
        });
      }
      if (ex.data === undefined || ex.data === null) {
        warnings.push({
          path: `${path}.data`,
          message: 'data ausente — pode falhar no pipeline.',
        });
      }

      if (typeof ex.type === 'string' && VALID_EXERCISE_TYPES.has(ex.type)) {
        const normalizedExercise = normalizeExerciseForPipeline(ex, i);
        const exerciseValidation = validateExercise(normalizedExercise);
        exerciseValidation.errors.forEach((message) => {
          errors.push({ path, message });
        });
        exerciseValidation.warnings.forEach((message) => {
          warnings.push({ path, message });
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    parsed: data,
  };
}
