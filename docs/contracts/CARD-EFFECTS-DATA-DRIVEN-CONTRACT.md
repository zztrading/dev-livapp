# Contrato V5 — Card-Effects Data-Driven

> Status: **vigente** (a partir desta correção). Validado pelo pipeline em
> `src/lib/v5/validateLessonJson.ts`. Reforçado no prompt do Custom GPT em
> `src/lib/v5/buildGptKit.ts` (regra 11).

## Problema que este contrato resolve

Card-effects V5 eram componentes React **hardcoded** com conteúdo fixo (ex.:
`CardEffectProblemIdentifier` falava sobre "Maria, vendas online, redes sociais").
Eles ignoravam as `props` do JSON da aula. Resultado: a narração falava de um
tema (ex.: contabilidade, mudança normativa) e os cards mostravam outro
(Maria com Instagram). Total desconexão.

## Tipos cobertos por este contrato

Cada tipo tem **layout próprio** especializado em
`src/components/lessons/card-effects/layouts/`. O `DataDrivenCard.tsx`
permanece apenas como fallback genérico para tipos data-driven futuros.

| `type` | uso pedagógico | layout | ícone default | colorScheme default |
|---|---|---|---|---|
| `strategic-shift`    | virada de mentalidade / antes→depois             | `ShiftLayout`     | `sparkles`     | `purple` |
| `problem-identifier` | 3 sintomas do problema atual                     | `AlertLayout`     | `zap`          | `orange` |
| `profit-calculator`  | 3 linhas do cálculo (valor/clientes/total)       | `CalculatorLayout`| `star`         | `gold`   |
| `automation`         | 3 etapas do fluxo automatizado                   | `FlowLayout`      | `rocket`       | `green`  |
| `human-check`        | 3 etapas da validação humana                     | `ChecklistLayout` | `shield-check` | `blue`   |

Ver também o **Modelo Padrão AT** em `docs/contracts/MODELO-PADRAO-AT.md`,
que define a sincronização narration ↔ anchorText ↔ experienceCard.

## Schema obrigatório de `props`

```json
{
  "title": "string (obrigatório, não-vazio)",
  "subtitle": "string (opcional, recomendado)",
  "chapters": ["string", "string", "string"],
  "icon": "string (Lucide name, obrigatório)",
  "colorScheme": "string (obrigatório, ver lista)",
  "effectDescription": "string (opcional, descrição interna)"
}
```

### Valores aceitos

- **`icon`**: `sparkles`, `zap`, `star`, `rocket`, `book`, `book-open`,
  `lightbulb`, `target`, `trending-up`, `shield`, `shield-check`, `check`,
  `check-circle`, `brain`, `cog`, `gear`, `compass`, `users`.
- **`colorScheme`**: `purple`, `violet`, `indigo`, `blue`, `orange`, `gold`,
  `green`.

### Regras

1. `chapters` deve ter **pelo menos 3 itens**, todos strings não-vazias.
2. `title`, `subtitle` e `chapters` devem ser **derivados do
   `visualContent` da seção** — nunca genéricos.
3. Sem `props` válidas, o validador do pipeline **bloqueia a publicação**
   (não é warning, é erro).
4. Em runtime, se `props` chegarem ausentes/inválidas (ex.: aulas legadas),
   o componente cai num fallback hardcoded para retrocompatibilidade.

## Exemplo canônico (aula `c63ca5e9-...` — "Por que esse momento muda tudo")

```json
{
  "type": "strategic-shift",
  "anchorText": "A interpretação vira vantagem",
  "props": {
    "icon": "sparkles",
    "title": "A virada real",
    "chapters": [
      "Clareza pro cliente",
      "Velocidade na resposta",
      "Mais confiança"
    ],
    "subtitle": "Interpretação como vantagem",
    "colorScheme": "purple",
    "effectDescription": "Mostra a virada do momento atual"
  }
}
```

## Implementação

| Camada | Arquivo |
|---|---|
| Tipos compartilhados | `src/components/lessons/card-effects/types.ts` |
| Helpers (icon/color)  | `src/components/lessons/card-effects/_shared.ts` |
| Layout canônico       | `src/components/lessons/card-effects/DataDrivenCard.tsx` |
| Componentes           | `CardEffect{StrategicShift,ProblemIdentifier,ProfitCalculator,Automation,HumanCheck}.tsx` |
| Pipeline de props     | `src/components/lessons/card-effects/index.tsx` (DynamicCardEffect) |
| Call-sites            | `src/components/lessons/GuidedLessonV5.tsx` (linhas ~334 e ~1746) |
| Validador             | `src/lib/v5/validateLessonJson.ts` (`validateDataDrivenCardProps`) |
| Prompt GPT            | `src/lib/v5/buildGptKit.ts` (regra 11) |
