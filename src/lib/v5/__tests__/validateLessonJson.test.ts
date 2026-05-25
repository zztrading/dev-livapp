/**
 * Testes do validador prévio de JSON V5.
 *
 * Cobertura:
 *  - Parse: JSON inválido, array com 1 item, não-objeto
 *  - Top-level: model, title, trackId (UUID + trilhas ativas), trackName, orderIndex
 *  - Sections: vazio, visualContent curto, speechBubbleText > 60
 *  - Experience cards: tipo inválido (com sugestão), anchorText ausente / não encontrado,
 *    cards na última seção, total fora do range 3-5
 *  - Exercises: vazio, type inválido, count fora de 4-6, data ausente
 *
 * Filosofia: cada teste descreve UMA regra. Falha = a regra mudou.
 */

import { describe, it, expect } from 'vitest';
import { validateLessonJson } from '../validateLessonJson';
import { ACTIVE_TRACKS } from '../buildGptKit';
import { CARD_EFFECT_TYPES } from '@/components/lessons/card-effects';

const VALID_TRACK = ACTIVE_TRACKS[0];
const VALID_CARD_TYPE = CARD_EFFECT_TYPES[0];
const VALID_CARD_TYPE_2 = CARD_EFFECT_TYPES[1];
const VALID_CARD_TYPE_3 = CARD_EFFECT_TYPES[2];

/** Aula mínima válida — base para todos os testes. */
function buildValidLesson() {
  return {
    model: 'v5',
    title: 'Aula de teste do validador',
    trackId: VALID_TRACK.id,
    trackName: VALID_TRACK.name,
    orderIndex: 1,
    sections: [
      {
        id: 'sec-1',
        visualContent:
          'Texto inicial com âncora cinematográfica suficiente para passar o mínimo de chars.',
        speechBubbleText: 'Vamos começar',
        experienceCards: [
          {
            type: VALID_CARD_TYPE,
            anchorText: 'âncora cinematográfica',
          },
        ],
      },
      {
        id: 'sec-2',
        visualContent:
          'Segunda seção com mais conteúdo e a palavra ponte aparecendo de forma natural.',
        experienceCards: [
          {
            type: VALID_CARD_TYPE_2,
            anchorText: 'ponte',
          },
        ],
      },
      {
        id: 'sec-3',
        visualContent:
          'Terceira seção contendo o trecho mapa que servirá de gatilho do card.',
        experienceCards: [
          {
            type: VALID_CARD_TYPE_3,
            anchorText: 'mapa',
          },
        ],
      },
      {
        id: 'sec-4',
        visualContent: 'Fechamento sem cards — apenas a narração final da aula.',
      },
    ],
    exercises: [
      { type: 'multiple-choice', data: { question: 'q', options: [], answer: 0 } },
      { type: 'true-false', data: { statement: 's', answer: true } },
      { type: 'fill-in-blanks', data: { text: 't', blanks: [] } },
      { type: 'scenario-selection', data: { scenarios: [] } },
    ],
  };
}

describe('validateLessonJson — happy path', () => {
  it('aprova uma aula mínima bem-formada', () => {
    const r = validateLessonJson(JSON.stringify(buildValidLesson()));
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('aceita o JSON envolto em array com 1 elemento (formato comum do GPT)', () => {
    const r = validateLessonJson(JSON.stringify([buildValidLesson()]));
    expect(r.valid).toBe(true);
  });
});

describe('validateLessonJson — parse', () => {
  it('rejeita JSON sintaticamente inválido', () => {
    const r = validateLessonJson('{not json');
    expect(r.valid).toBe(false);
    expect(r.errors[0].path).toBe('(root)');
    expect(r.errors[0].message).toMatch(/JSON inválido/);
  });

  it('rejeita array com mais de 1 item', () => {
    const r = validateLessonJson(
      JSON.stringify([buildValidLesson(), buildValidLesson()])
    );
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toMatch(/array com 2 itens/);
  });

  it('rejeita raiz que não é objeto', () => {
    const r = validateLessonJson(JSON.stringify('não sou objeto'));
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toMatch(/não é um objeto/);
  });
});

describe('validateLessonJson — campos top-level', () => {
  it('rejeita model diferente de "v5"', () => {
    const lesson = { ...buildValidLesson(), model: 'v8' };
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.path === 'model')).toBe(true);
  });

  it('rejeita title ausente ou muito curto', () => {
    const lesson = { ...buildValidLesson(), title: 'ab' };
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.path === 'title')).toBe(true);
  });

  it('rejeita trackId que não é UUID', () => {
    const lesson = { ...buildValidLesson(), trackId: 'nao-eh-uuid' };
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.path === 'trackId')).toBe(true);
  });

  it('aceita UUID válido fora das trilhas ativas, mas avisa', () => {
    const lesson = {
      ...buildValidLesson(),
      trackId: '00000000-0000-4000-8000-000000000000',
    };
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(r.valid).toBe(true);
    expect(r.warnings.some((w) => w.path === 'trackId')).toBe(true);
  });

  it('rejeita orderIndex não positivo', () => {
    const lesson = { ...buildValidLesson(), orderIndex: 0 };
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.path === 'orderIndex')).toBe(true);
  });
});

describe('validateLessonJson — sections', () => {
  it('rejeita sections vazio', () => {
    const lesson = { ...buildValidLesson(), sections: [] };
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.path === 'sections')).toBe(true);
  });

  it('rejeita visualContent curto demais', () => {
    const lesson = buildValidLesson();
    lesson.sections[0].visualContent = 'curto';
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(r.valid).toBe(false);
    expect(
      r.errors.some((e) => e.path.endsWith('.visualContent'))
    ).toBe(true);
  });

  it('rejeita speechBubbleText acima de 60 chars', () => {
    const lesson = buildValidLesson();
    lesson.sections[0].speechBubbleText = 'a'.repeat(61);
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(r.valid).toBe(false);
    expect(
      r.errors.some((e) => e.path.endsWith('.speechBubbleText'))
    ).toBe(true);
  });
});

describe('validateLessonJson — experience cards', () => {
  it('rejeita card.type inexistente no catálogo', () => {
    const lesson = buildValidLesson();
    (lesson.sections[0].experienceCards as any)[0].type = 'tipo-que-nao-existe-xyz';
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(r.valid).toBe(false);
    const err = r.errors.find((e) => e.path.endsWith('.type'));
    expect(err).toBeDefined();
    expect(err!.message).toMatch(/não existe no catálogo/);
  });

  it('sugere o tipo mais próximo quando há erro de digitação', () => {
    const lesson = buildValidLesson();
    // Tira uma letra do tipo válido — deve sugerir o original
    const typo = String(VALID_CARD_TYPE).slice(0, -1);
    (lesson.sections[0].experienceCards as any)[0].type = typo;
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(r.valid).toBe(false);
    const err = r.errors.find((e) => e.path.endsWith('.type'));
    expect(err?.suggestion).toBe(VALID_CARD_TYPE);
  });

  it('avisa quando anchorText não aparece no visualContent da seção', () => {
    const lesson = buildValidLesson();
    (lesson.sections[0].experienceCards as any)[0].anchorText =
      'palavra completamente fora do texto';
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(r.valid).toBe(true); // só warning
    expect(
      r.warnings.some((w) => w.path.endsWith('.anchorText'))
    ).toBe(true);
  });

  it('avisa quando a última seção tem experience cards', () => {
    const lesson = buildValidLesson();
    lesson.sections[lesson.sections.length - 1].experienceCards = [
      { type: VALID_CARD_TYPE, anchorText: 'narração final' },
    ];
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(
      r.warnings.some((w) =>
        w.message.includes('Última seção')
      )
    ).toBe(true);
  });

  it('avisa quando total de cards está fora de 3-5', () => {
    const lesson = buildValidLesson();
    // remove todos os cards (total = 0)
    lesson.sections.forEach((s: any) => {
      delete s.experienceCards;
    });
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(
      r.warnings.some((w) => w.path === 'sections' && /Total de 0/.test(w.message))
    ).toBe(true);
  });
});

describe('validateLessonJson — experience cards no root level', () => {
  /** Aula com sections sem cards inline; cards vêm no root via sectionIndex. */
  function buildLessonWithRootCards(rootCards: any[]) {
    const base = buildValidLesson();
    base.sections.forEach((s: any) => {
      delete s.experienceCards;
    });
    (base as any).experienceCards = rootCards;
    return base;
  }

  it('aceita 5 cards root distribuídos em seções 1-3 sem warning de range', () => {
    const lesson = buildLessonWithRootCards([
      { type: VALID_CARD_TYPE, sectionIndex: 1, anchorText: 'âncora cinematográfica' },
      { type: VALID_CARD_TYPE_2, sectionIndex: 1, anchorText: 'âncora cinematográfica' },
      { type: VALID_CARD_TYPE_3, sectionIndex: 2, anchorText: 'ponte' },
      { type: VALID_CARD_TYPE, sectionIndex: 2, anchorText: 'ponte' },
      { type: VALID_CARD_TYPE_2, sectionIndex: 3, anchorText: 'mapa' },
    ]);
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
    expect(
      r.warnings.some(
        (w) => w.path === 'sections' && /Total de \d+/.test(w.message)
      )
    ).toBe(false);
  });

  it('rejeita card root sem sectionIndex', () => {
    const lesson = buildLessonWithRootCards([
      { type: VALID_CARD_TYPE, anchorText: 'âncora cinematográfica' },
      { type: VALID_CARD_TYPE_2, sectionIndex: 2, anchorText: 'ponte' },
      { type: VALID_CARD_TYPE_3, sectionIndex: 3, anchorText: 'mapa' },
    ]);
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(r.valid).toBe(false);
    expect(
      r.errors.some(
        (e) =>
          e.path === 'experienceCards[0].sectionIndex' &&
          /obrigatório/.test(e.message)
      )
    ).toBe(true);
  });

  it('rejeita card root com sectionIndex fora do range', () => {
    const lesson = buildLessonWithRootCards([
      { type: VALID_CARD_TYPE, sectionIndex: 1, anchorText: 'âncora cinematográfica' },
      { type: VALID_CARD_TYPE_2, sectionIndex: 99, anchorText: 'ponte' },
      { type: VALID_CARD_TYPE_3, sectionIndex: 3, anchorText: 'mapa' },
    ]);
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(r.valid).toBe(false);
    const err = r.errors.find(
      (e) => e.path === 'experienceCards[1].sectionIndex'
    );
    expect(err).toBeDefined();
    expect(err!.message).toMatch(/1\.\.4/);
  });

  it('rejeita card root com type inexistente e oferece sugestão', () => {
    const typo = String(VALID_CARD_TYPE).slice(0, -1);
    const lesson = buildLessonWithRootCards([
      { type: typo, sectionIndex: 1, anchorText: 'âncora cinematográfica' },
      { type: VALID_CARD_TYPE_2, sectionIndex: 2, anchorText: 'ponte' },
      { type: VALID_CARD_TYPE_3, sectionIndex: 3, anchorText: 'mapa' },
    ]);
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(r.valid).toBe(false);
    const err = r.errors.find((e) => e.path === 'experienceCards[0].type');
    expect(err?.suggestion).toBe(VALID_CARD_TYPE);
  });

  it('avisa (não erra) quando anchorText não aparece no visualContent da seção apontada', () => {
    const lesson = buildLessonWithRootCards([
      { type: VALID_CARD_TYPE, sectionIndex: 1, anchorText: 'frase totalmente fora do texto' },
      { type: VALID_CARD_TYPE_2, sectionIndex: 2, anchorText: 'ponte' },
      { type: VALID_CARD_TYPE_3, sectionIndex: 3, anchorText: 'mapa' },
    ]);
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(r.valid).toBe(true);
    expect(
      r.warnings.some(
        (w) =>
          w.path === 'experienceCards[0].anchorText' &&
          /seção 1/.test(w.message)
      )
    ).toBe(true);
  });

  it('soma corretamente cards inline + root no totalCards (mistura 2 + 3 = 5)', () => {
    const lesson = buildValidLesson();
    // sections[0] e sections[1] já têm 1 card inline cada (= 2 inline)
    delete (lesson.sections[2] as any).experienceCards;
    (lesson as any).experienceCards = [
      { type: VALID_CARD_TYPE, sectionIndex: 2, anchorText: 'ponte' },
      { type: VALID_CARD_TYPE_2, sectionIndex: 3, anchorText: 'mapa' },
      { type: VALID_CARD_TYPE_3, sectionIndex: 3, anchorText: 'mapa' },
    ];
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(r.errors).toEqual([]);
    // Sem warning de range (total = 5, dentro de 3..5)
    expect(
      r.warnings.some(
        (w) => w.path === 'sections' && /Total de \d+/.test(w.message)
      )
    ).toBe(false);
  });
});

describe('validateLessonJson — exercises', () => {
  it('rejeita exercises vazio', () => {
    const lesson = { ...buildValidLesson(), exercises: [] };
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.path === 'exercises')).toBe(true);
  });

  it('rejeita exercise.type fora da whitelist', () => {
    const lesson = buildValidLesson();
    (lesson.exercises as any)[0].type = 'tipo-invalido';
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(r.valid).toBe(false);
    expect(
      r.errors.some((e) => e.path === 'exercises[0].type')
    ).toBe(true);
  });

  it('avisa quando count de exercises está fora de 4-6', () => {
    const lesson = buildValidLesson();
    lesson.exercises = [lesson.exercises[0]]; // só 1
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(
      r.warnings.some((w) => w.path === 'exercises' && /1 exercises/.test(w.message))
    ).toBe(true);
  });

  it('avisa quando exercise.data está ausente', () => {
    const lesson = buildValidLesson();
    delete (lesson.exercises[0] as any).data;
    const r = validateLessonJson(JSON.stringify(lesson));
    expect(
      r.warnings.some((w) => w.path === 'exercises[0].data')
    ).toBe(true);
  });
});
