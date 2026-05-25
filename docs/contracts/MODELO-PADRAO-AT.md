# Contrato — Modelo Padrão AT (Anchor Text + Experience Card)

> Padrão V5 oficial para aulas com narração sincronizada a card-effects
> data-driven especializados. Aula referência: **c63ca5e9-abc9-4ff9-b5b9-c69d77fbe282**.

## 1. Definição

Cada `section` da aula entrega ao player três peças que contam a **mesma**
história em três canais:

| Canal      | Campo                          | Papel                                                                 |
|------------|--------------------------------|-----------------------------------------------------------------------|
| Áudio      | `narration`                    | Texto que o LIV narra. Conduz o ritmo.                                |
| Texto      | `anchorText`                   | Substring **exata** da narration. Gatilho do player.                  |
| Visual     | `experienceCard.props`         | `title`, `subtitle`, `chapters[3]`, `icon`, `colorScheme`. Animação.  |

Quando o player encontra `anchorText` no áudio, revela o card; o card revela
seus chapters em sincronia com a evolução da narração.

## 2. Estrutura por seção

```jsonc
{
  "narration": "...frase contendo o anchor exato...",
  "anchorText": "anchor exato",          // substring de narration
  "experienceCard": {
    "type": "strategic-shift",
    "props": {
      "title": "...",
      "subtitle": "...",
      "chapters": ["...", "...", "..."], // exatamente 3, frases autossuficientes
      "icon": "sparkles",                // ver _shared.ts ICON_MAP
      "colorScheme": "purple"            // ver _shared.ts COLOR_SCHEMES
    }
  }
}
```

## 3. Matriz tipo → layout

| `experienceCard.type`  | Layout (`src/components/lessons/card-effects/layouts/`) | Visual                                                             |
|------------------------|---------------------------------------------------------|--------------------------------------------------------------------|
| `strategic-shift`      | `ShiftLayout.tsx`                                       | Linhas "antes(cinza) → seta animada → depois(glow)"                |
| `problem-identifier`   | `AlertLayout.tsx`                                       | Sintomas pulsando, halo radial, badge `!`                          |
| `profit-calculator`    | `CalculatorLayout.tsx`                                  | Linhas de extrato com símbolos crescentes, total `R$ N` contando   |
| `automation`           | `FlowLayout.tsx`                                        | Nós verticais ligados por setas, badge "Fluxo ativo" final         |
| `human-check`          | `ChecklistLayout.tsx`                                   | Itens com checkbox marcando um a um, selo "Confirmado"             |

Tipos data-driven futuros sem layout próprio caem no fallback
`DataDrivenCard.tsx`.

## 4. Pipeline de garantia

1. **GPT (regra 11 em `buildGptKit.ts`)** — força emissão do schema completo de
   `props` para os 5 tipos.
2. **`validateLessonJson.ts`** — bloqueia a publicação se algum dos 5 tipos vier
   sem `props.title` ou sem `chapters[≥3 não vazios]`.
3. **Runtime (`DynamicCardEffect` em `card-effects/index.tsx`)** — propaga `props`
   ao componente; o componente prefere a versão data-driven via
   `hasDataDrivenContent(props)` e cai em `Legacy*` se ausente.

## 5. Checklist de auditoria manual

Aplicar antes de marcar qualquer aula V5 como "Padrão AT":

- [ ] Cada um dos 5 tipos relevantes tem `props.title` + `chapters[3]` válidos.
- [ ] Cada `chapter` é frase curta, autossuficiente, ligada ao `anchorText`.
- [ ] `icon` e `colorScheme` resolvem em `_shared.ts`.
- [ ] `anchorText` é substring exata de `narration`.
- [ ] Em runtime, cada card mostra o **layout específico** do seu tipo (não o
      fallback genérico `DataDrivenCard`).

## 6. Aula referência canônica

`c63ca5e9-abc9-4ff9-b5b9-c69d77fbe282` — usar como gabarito vivo.

## 7. Arquivos-chave

- `src/components/lessons/card-effects/_shared.ts`
- `src/components/lessons/card-effects/layouts/{Shift,Alert,Calculator,Flow,Checklist}Layout.tsx`
- `src/components/lessons/card-effects/DataDrivenCard.tsx` (fallback)
- `src/components/lessons/card-effects/CardEffect{StrategicShift,ProblemIdentifier,ProfitCalculator,Automation,HumanCheck}.tsx`
- `src/lib/v5/validateLessonJson.ts`
- `src/lib/v5/buildGptKit.ts`
- `docs/contracts/CARD-EFFECTS-DATA-DRIVEN-CONTRACT.md`
