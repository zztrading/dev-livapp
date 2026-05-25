# Auditoria — Conversão dos Card-Effects para Data-Driven

> Tracking da migração dos card-effects V5 do modelo "hardcoded" para o
> modelo "data-driven" (definido em
> `docs/contracts/CARD-EFFECTS-DATA-DRIVEN-CONTRACT.md`).

## Status global

- **Total de card-effects no catálogo:** 217
- **Convertidos para data-driven:** 5
- **Pendentes:** 212

A migração é incremental: o pipeline (validador) só **exige** `props`
para os tipos já marcados como data-driven. Os 212 restantes seguem
funcionando como hardcoded até serem migrados sob demanda.

## Convertidos ✅

| `type` | componente | PR / commit |
|---|---|---|
| `strategic-shift`    | `CardEffectStrategicShift.tsx`    | feat/card-effects-data-driven |
| `problem-identifier` | `CardEffectProblemIdentifier.tsx` | feat/card-effects-data-driven |
| `profit-calculator`  | `CardEffectProfitCalculator.tsx`  | feat/card-effects-data-driven |
| `automation`         | `CardEffectAutomation.tsx`        | feat/card-effects-data-driven |
| `human-check`        | `CardEffectHumanCheck.tsx`        | feat/card-effects-data-driven |

### Fix v2 — Diversificação visual (Modelo Padrão AT)

A v1 roteava os 5 wrappers para o mesmo `DataDrivenCard.tsx`, gerando
uniformidade visual (sem efeito UAU). Esta correção introduz **5 layouts
especializados** em `src/components/lessons/card-effects/layouts/`:

| Tipo                 | Layout             |
|----------------------|--------------------|
| `strategic-shift`    | `ShiftLayout`      |
| `problem-identifier` | `AlertLayout`      |
| `profit-calculator`  | `CalculatorLayout` |
| `automation`         | `FlowLayout`       |
| `human-check`        | `ChecklistLayout`  |

`DataDrivenCard.tsx` permanece como fallback genérico para tipos
data-driven futuros sem layout próprio.

Cada wrapper:
- Recebe `props` (interface `CardEffectProps` em
  `src/components/lessons/card-effects/index.tsx`).
- Se `hasDataDrivenContent(props)` → renderiza o layout específico do tipo
  com defaults próprios (`defaultIconName` + `defaultColorScheme`).
- Caso contrário → renderiza `<Legacy*Component />` (conteúdo original
  preservado para retrocompatibilidade com aulas antigas).

Modelo Padrão AT formalizado em `docs/contracts/MODELO-PADRAO-AT.md`.
Aula referência: `c63ca5e9-abc9-4ff9-b5b9-c69d77fbe282`.

## Pendentes (amostragem)

A lista completa está em `CARD_EFFECT_TYPES` em
`src/components/lessons/card-effects/index.tsx`.

Critério de priorização: converter quando uma aula nova falhar no
preview por inconsistência narração/visual.

## Como adicionar um novo tipo data-driven

1. No componente, adicionar `props` ao destructuring e o branch:
   ```tsx
   if (hasDataDrivenContent(props)) {
     return (
       <DataDrivenCard
         {...toDataDrivenProps(props)}
         isActive={isActive}
         duration={duration}
         defaultIconName="..."
         defaultColorScheme="..."
       />
     );
   }
   return <LegacyXxx isActive={isActive} duration={duration} />;
   ```
2. Adicionar o `type` ao `DATA_DRIVEN_CARD_TYPES` em
   `src/lib/v5/validateLessonJson.ts`.
3. Adicionar o `type` à tabela do prompt em
   `src/lib/v5/buildGptKit.ts` (regra 11).
4. Atualizar este arquivo + o contrato.
