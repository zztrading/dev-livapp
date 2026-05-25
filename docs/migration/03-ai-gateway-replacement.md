# Fase 3 — Substituir Lovable AI Gateway

23 edge functions chamam `https://ai.gateway.lovable.dev/v1/chat/completions` com o secret `LOVABLE_API_KEY`. Precisamos trocar por chamadas diretas aos providers.

## Functions afetadas

```
claude-interact                        (V5 playground chat)
generate-card-effects                  (V5 card effects)
image-lab-generate, image-lab-generate-batch, image-lab-pipeline-bridge

lesson-playground                      (V8 playground)
v7-code-analysis
v8-audit-exercises
v8-evaluate-prompt
v8-generate-lesson-content
v8-generate-raw-content
v8-generate-section-image
v8-generate-variations
v8-refine-content

v10-enrich-frames
v10-generate-ai-image
v10-generate-audio                     (parte texto, áudio é ElevenLabs)
v10-generate-images
v10-generate-mockups
v10-generate-steps
v10-preview-score
v10-score-bpa
v10-suggest-topics
```

## Modelos usados hoje (model id Lovable → provider real)

| Lovable model id | Provider real | Endpoint nativo |
|---|---|---|
| `google/gemini-2.5-pro` | Google | `gemini-2.5-pro` via Generative Language API |
| `google/gemini-2.5-flash` | Google | `gemini-2.5-flash` |
| `google/gemini-2.5-flash-lite` | Google | `gemini-2.5-flash-lite` |
| `google/gemini-2.5-flash-image` | Google | `gemini-2.5-flash-image-preview` (Nano Banana) |
| `google/gemini-3-flash-preview` | Google | `gemini-3-flash-preview` |
| `google/gemini-3-pro-image-preview` | Google | `gemini-3-pro-image-preview` |
| `openai/gpt-5` | OpenAI | `gpt-5` (quando disponível) ou `gpt-4o` |
| `openai/gpt-5-mini` | OpenAI | `gpt-5-mini` ou `gpt-4o-mini` |
| `openai/gpt-5-nano` | OpenAI | `gpt-5-nano` ou `gpt-4o-mini` |

## Estratégia de migração

### Opção 1: Chamadas diretas (recomendado se quiser controle máximo)
- Pro: 0 dependência de terceiros, custo direto, latência mínima.
- Contra: precisa de SDK/auth de cada provider, formato de resposta varia.

### Opção 2: OpenRouter (gateway unificado, similar ao Lovable)
- Pro: 1 só secret (`OPENROUTER_API_KEY`), mesma assinatura `openai/v1/chat/completions`, mesma sintaxe de model id (`google/gemini-2.5-flash`).
- Pro: troca de 23 functions vira "1 search-replace": `ai.gateway.lovable.dev` → `openrouter.ai/api`.
- Contra: margem extra do OpenRouter (~5-10%).

**Recomendação prática**: Opção 2 (OpenRouter) para acelerar migração e validar paridade. Trocar para Opção 1 (direto) depois, se custo apertar.

## Helper compartilhado

Criar `supabase/functions/_shared/ai-gateway.ts`:

```ts
// Opção 2 (OpenRouter) — drop-in replacement do Lovable AI Gateway
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')!;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function aiChatCompletion(payload: {
  model: string;
  messages: Array<{ role: string; content: any }>;
  temperature?: number;
  max_tokens?: number;
  response_format?: any;
  tools?: any;
}) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://aiiv.app', // ajustar domínio final
      'X-Title': 'AIliv',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`AI gateway error ${res.status}: ${await res.text()}`);
  return res.json();
}
```

## Search-replace por function

Para cada uma das 23 functions:

```diff
- const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
- const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
-   method: 'POST',
-   headers: {
-     'Authorization': `Bearer ${LOVABLE_API_KEY}`,
-     'Content-Type': 'application/json',
-   },
-   body: JSON.stringify({ model, messages, ... }),
- });
- const data = await res.json();

+ import { aiChatCompletion } from '../_shared/ai-gateway.ts';
+ const data = await aiChatCompletion({ model, messages, ... });
```

## Validação por function (obrigatório)

Para cada function migrada:
1. Chamar 1x via Lovable Gateway (estado atual), salvar output como `validation/old-<function>.json`
2. Chamar 1x via novo helper (mesmos inputs), salvar como `validation/new-<function>.json`
3. `diff old new` — esperar diferenças apenas em campos efêmeros (timestamps, ids, request_id)
4. Validar manualmente: aula gerada renderiza? exercício é jogável? mockup compila?
5. Só remover `LOVABLE_API_KEY` após **todas as 23 validadas**.

## Imagens (Nano Banana)

`v8-generate-section-image`, `v10-generate-images`, `v10-generate-ai-image`, `image-lab-generate*` usam `google/gemini-2.5-flash-image`. OpenRouter suporta esse modelo. Validar particularmente o formato de retorno de imagens base64.
