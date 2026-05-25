# Auditoria: Remoção de Exercícios Open-Text (Texto Livre)

**Data**: 2026-05-03  
**Escopo**: Eliminação total de caixas de texto livre (open-text / textarea) em exercícios do AIliv.

## Motivação

Exercícios com `<Textarea>` aberto não têm validação pedagógica útil:
- Não medem aprendizado real (qualquer resposta passa);
- Quebram a UX em mobile;
- Permitem cópia e pulagem trivial;
- Inflam o pipeline com lógica condicional desnecessária.

**Mantemos** AI Playgrounds interativos (`PlaygroundMidLesson`, `V7UserChallengeInput`) — eles são chats com IA, não "exercícios open-text".

## Estado Antes da Correção

```sql
SELECT count(*) FROM lessons WHERE exercises::text ILIKE '%open-text%' AND is_active = true;
-- 2 aulas afetadas
```

| Lesson ID | Título | Índice do Exercício |
|---|---|---|
| `c63ca5e9-abc9-4ff9-b5b9-c69d77fbe282` | A Camada de Interpretação: I.A. no Escritório Contábil | 5 (último) |
| `21a5d254-b941-490f-948e-62257b077c49` | A Camada de Interpretação: I.A. para Escritórios Contábeis | 5 (último) |

## Mudanças Aplicadas

### Fase 1 — Banco de Dados
Migration `UPDATE lessons SET exercises = jsonb_set(...)` substituiu o exercício open-text por `multiple-choice` contextual em ambas as aulas.

### Fase 2 — Validator Hardening
- `src/lib/exerciseValidator.ts::validateDataCollection`: rejeita `data.mode === 'open-text'` com erro crítico.

### Fase 3 — Pipeline Normalization
- `src/lib/lessonPipeline/exerciseNormalization.ts::normalizeDataCollectionExerciseData`: strip de `mode/question/placeholder/maxLength` quando legado open-text chega.

### Fase 4 — UI / Tipos
- `src/components/lessons/DataCollectionExercise.tsx`: removido o branch open-text + import de `Textarea`. Componente agora aceita SOMENTE `scenario` (checkboxes).
- `src/components/lessons/ExercisesSection.tsx`: removidas props `mode/question/placeholder/maxLength` da renderização.
- `src/components/lessons/GuidedPlayground.tsx`: removido branch `type === 'textarea'` e import `Textarea`.
- `src/types/guidedLesson.ts::FinalPlaygroundStep`: union `'radio' | 'textarea' | 'prompt-builder'` → `'radio' | 'prompt-builder'`.
- `src/data/lessons/fundamentos-02.ts`: step legado `textarea` convertido em `radio` com 4 opções.

### Fase 5 — Tests
- `src/lib/lessonPipeline/__tests__/step1ExerciseNormalization.test.ts`: caso de teste invertido — agora valida que open-text é stripado.

### Fase 6 — Memory
- Criada `mem://v5/contract/no-open-text-exercises`.

## Verificação Pós-Correção

```sql
SELECT count(*) FROM lessons WHERE exercises::text ILIKE '%open-text%' AND is_active = true;
-- 0
```

## Componentes Mantidos (Não Confundir)
- `PlaygroundMidLesson` — chat com IA, scoring por Jaccard (V8 spec).
- `V7UserChallengeInput` — desafio com feedback de IA.
- `BeforeAfterLesson`, `QuizPlaygroundLesson` — confirmados sem registros ativos no DB; podem ser deprecados em sweep futuro.
