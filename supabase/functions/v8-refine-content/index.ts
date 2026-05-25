import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REFINE_SYSTEM_PROMPT = `Você é um editor didático especializado em educação sobre Inteligência Artificial para público brasileiro leigo.

Sua tarefa é refinar o texto de seções de aula, melhorando a FORMA sem alterar o CONTEÚDO conceitual.

REGRAS OBRIGATÓRIAS:

1. **Clareza**: O conteúdo deve ser didático e fácil de entender para qualquer pessoa, inclusive leigos completos.

2. **Vocabulário acessível**: Elimine gírias ambíguas, expressões com duplo sentido ou frases coloquiais que confundem. Exemplos:
   - "responde no seguro" → "responde de forma genérica e cautelosa"
   - "o que ele faz por trás" → "como ele funciona internamente"
   - "dar um tapa" em algo → "melhorar" ou "refinar"
   - "jogar no colo" → "entregar diretamente"
   - "meter a mão na massa" → "começar a praticar"

3. **Coerência narrativa**: Mantenha o fio condutor da história, garantindo que cada seção conecte logicamente com a anterior.

4. **Fluência**: Vocabulário natural, ritmo de leitura agradável, sem frases truncadas ou transições abruptas.

5. **Tom conversacional mas preciso**: Mantenha o tom amigável e acessível do original, mas sem sacrificar clareza.

6. **Preservar estrutura**: NÃO altere marcadores como [QUIZ], [PLAYGROUND], [EXERCISE:tipo], [AI_IMAGE], [VIDEO], títulos ##, nem a organização das seções. Copie-os EXATAMENTE como estão. Blocos [AI_IMAGE] com prompt: e caption: devem ser copiados INTEIRAMENTE sem modificar o prompt nem o caption. Blocos [VIDEO] com src: e caption: devem ser copiados INTEIRAMENTE sem modificação. NÃO insira tags de prosódia/emoção como [excited], [pause], [warm] etc. — o modelo de áudio atual não as suporta.

7. **Preservar intenção**: Melhore a FORMA, não mude o CONTEÚDO conceitual. Exemplos, metáforas e analogias devem ser mantidos ou melhorados, nunca removidos.

8. **Eliminar redundâncias**: Se uma seção repete a mesma ideia da anterior com outras palavras, condense.

9. **Brevidade**: Seções de narração devem ser objetivas — entre 100 e 300 palavras por seção (15-30s de áudio).

10. **Evitar jargão técnico não explicado**: Se um termo técnico é necessário (ex: "token", "modelo de linguagem"), deve ser explicado na primeira ocorrência.

11. **Transições explícitas**: Cada seção deve começar com uma frase que conecte ao que veio antes ("Agora que você entendeu X, vamos ver Y...").

12. **Exemplos concretos**: Se o texto fala de algo abstrato, deve ter pelo menos um exemplo do mundo real na mesma seção.

13. **Detecção de texto pré-quiz/playground**: Se a seção termina com uma frase que é literalmente a pergunta do quiz seguinte (como "Responde rápido pra mim: quando o GPT parece genérico..."), REMOVA essa frase redundante da seção, pois o quiz já vai narrá-la.

16. **NUNCA termine uma seção com uma pergunta interrogativa**. Seções devem terminar com afirmações, insights ou transições declarativas. Se a última frase da seção terminar com "?", REESCREVA para ser uma afirmação.

17. **PROIBIDO criar frases que funcionem como enunciado de exercício**. Exemplos proibidos: "Teste rápido:", "Vamos testar:", "Qual dos seguintes...", "Responda:", "Agora é sua vez:", "Vamos aplicar:". Exercícios são gerados separadamente pelo pipeline e NÃO devem ser antecipados no texto da seção.

IMPORTANTE:
- NUNCA gere rótulos meta-narrativos como "Segmento vida real desta atividade:", "Atividade prática:" ou "Contexto real:".
- NUNCA use frases anti-pedagógicas como "Responda rapidamente" ou "Confie nos seus instintos".
- Retorne EXATAMENTE o mesmo número de seções recebidas.
- Cada seção deve manter o mesmo título (pode melhorar levemente se necessário).
- O conteúdo deve estar em Português Brasileiro (pt-BR).

CONGRUÊNCIA GRAMATICAL OBRIGATÓRIA:
- Todos os textos DEVEM ter concordância sujeito-verbo e gênero-número correta.
- ERRO CLÁSSICO: "Sou um casal" → CORRETO: "Somos um casal". Sujeito coletivo/plural exige verbo concordante.
- Outros erros proibidos: "Nós é" → "Nós somos", "A gente vamos" → "A gente vai", "Eu e minha esposa vai" → "Eu e minha esposa vamos".
- Revise CADA frase para garantir concordância antes de retornar.

14. **Sem caracteres não-latinos**: NUNCA insira caracteres de outros alfabetos (Devanagari, Cirílico, Árabe, CJK, Tailandês, Coreano). Todo o texto deve usar exclusivamente o alfabeto latino com acentos portugueses (á, é, í, ó, ú, ã, õ, ç, etc.). Se encontrar palavras em outros scripts no texto original, substitua pelo equivalente em português.

15. **Formatação Editorial Obrigatória**: O conteúdo DEVE usar elementos de markdown que ativam o design premium do renderer:
   - Use **negrito** para termos-chave e conceitos importantes (2-4 por seção)
   - Use > blockquotes para insights, reflexões ou frases de destaque (1 por seção quando apropriado)
   - Use listas com bullet points para enumerações (quando houver 3+ itens)
   - Use --- (separador horizontal) entre blocos temáticos distintos dentro de uma seção
   - Use *itálico* para exemplos práticos ou analogias
   - O primeiro parágrafo de cada seção deve ser o mais forte e impactante (ele recebe estilo drop-cap no renderer)`;

const REFINE_TOOLS = [
  {
    type: "function",
    function: {
      name: "refine_sections",
      description: "Return the refined sections with improved didactic quality. Must return exactly the same number of sections as input.",
      parameters: {
        type: "object",
        properties: {
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Section title (keep or slightly improve)" },
                content: { type: "string", description: "Refined section content in pt-BR" },
              },
              required: ["title", "content"],
            },
          },
        },
        required: ["sections"],
      },
    },
  },
];

function sanitizePedagogicalText(text: string): string {
  return text
    .replace(/(^|\n)\s*(?:Segmento\s+vida\s+real\s+desta\s+atividade|Atividade\s+prática|Atividade\s+pratica|Contexto\s+real)\s*:[^\n]*(?=\n|$)/gi, '$1')
    .replace(/(^|\n)\s*(?:Responda rapidamente[^\n]*|Confie nos seus instintos[^\n]*|Sem pensar muito[^\n]*|Responda agora[^\n]*)(?=\n|$)/gi, '$1')
    // Strip non-Latin scripts
    .replace(/[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0600-\u06FF\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\u0E00-\u0E7F\uAC00-\uD7AF]/g, '')
    // Strip ALL bracket tags EXCEPT structural markers (v2 does not support audio/prosody tags)
    .replace(/\[([^\]]{1,80})\]/gi, (match, inner) => {
      if (/^(quiz|playground|exercise:[a-z_-]+|ai_image|video)$/i.test(inner.trim())) return match;
      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sections } = await req.json();

    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return new Response(JSON.stringify({ error: "sections[] is required and must be non-empty" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    console.log(`[v8-refine-content] Refining ${sections.length} sections in parallel batches...`);

    // ===== BATCHED PARALLEL REFINEMENT =====
    // Refining all sections in a single AI call frequently exceeds the 150s edge
    // function timeout. Split into small batches (3 sections each) and run them
    // in parallel — each call is fast (~15-30s) and total wall time stays low.
    const BATCH_SIZE = 3;
    const PER_CALL_TIMEOUT_MS = 90_000;

    const batches: { startIndex: number; items: any[] }[] = [];
    for (let i = 0; i < sections.length; i += BATCH_SIZE) {
      batches.push({ startIndex: i, items: sections.slice(i, i + BATCH_SIZE) });
    }

    async function refineBatch(batchItems: any[], startIndex: number): Promise<any[]> {
      const sectionsText = batchItems.map((s: any, i: number) =>
        `### Seção ${startIndex + i + 1}: ${s.title}\n${s.content}`
      ).join("\n\n---\n\n");

      const userPrompt = `Refine as ${batchItems.length} seções abaixo. Retorne EXATAMENTE ${batchItems.length} seções refinadas.

REGRAS ESTRITAS DE ORDENAÇÃO:
- Retorne as seções NA MESMA ORDEM em que foram recebidas.
- NÃO renomeie a primeira seção se ela se chamar "Abertura".
- NÃO funda, elimine ou reordene seções.

${sectionsText}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: REFINE_SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            tools: REFINE_TOOLS,
            tool_choice: { type: "function", function: { name: "refine_sections" } },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[v8-refine-content] Batch @${startIndex} AI error ${response.status}:`, errText.slice(0, 300));
          if (response.status === 429 || response.status === 402) {
            const err: any = new Error(response.status === 429 ? "rate_limit" : "credits_exhausted");
            err.status = response.status;
            throw err;
          }
          // Fallback: return originals on transient failure
          return batchItems;
        }

        const data = await response.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) {
          console.warn(`[v8-refine-content] Batch @${startIndex}: no tool call, returning originals`);
          return batchItems;
        }
        const parsed = JSON.parse(toolCall.function.arguments);
        const out = Array.isArray(parsed.sections) ? parsed.sections : [];
        // Ensure count matches
        while (out.length < batchItems.length) out.push(batchItems[out.length]);
        out.length = batchItems.length;
        return out;
      } catch (err: any) {
        if (err?.status === 429 || err?.status === 402) throw err;
        console.warn(`[v8-refine-content] Batch @${startIndex} failed, returning originals:`, err?.message);
        return batchItems;
      } finally {
        clearTimeout(timer);
      }
    }

    let batchResults: any[][];
    try {
      batchResults = await Promise.all(batches.map((b) => refineBatch(b.items, b.startIndex)));
    } catch (err: any) {
      if (err?.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a few seconds." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (err?.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Add funds in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw err;
    }

    const refinedSections: any[] = batchResults.flat();

    // Validate count matches
    if (refinedSections.length !== sections.length) {
      console.warn(`[v8-refine-content] Count mismatch: got ${refinedSections.length}, expected ${sections.length}. Padding/truncating.`);
      while (refinedSections.length < sections.length) {
        refinedSections.push(sections[refinedSections.length]);
      }
      refinedSections.length = sections.length;
    }

    // === V8-C01 GUARANTEE: Section 0 SEMPRE deve se chamar "Abertura" ===
    // Independente do título original do input ou do que a IA retornar,
    // forçamos sections[0].title = "Abertura" para passar o gate V8-C01.
    // Isso preserva todo o conteúdo, apenas normaliza o título da seção de abertura.
    if (refinedSections[0]) {
      const originalTitle = refinedSections[0].title;
      if (!String(originalTitle || '').toLowerCase().includes("abertura")) {
        console.warn(`[v8-refine-content] V8-C01 ENFORCE: forcing Section 0 title from "${originalTitle}" → "Abertura"`);
      }
      refinedSections[0].title = "Abertura";
    }

    const sanitizedSections = refinedSections.map((s: any, i: number) => ({
      title: i === 0
        ? "Abertura"
        : sanitizePedagogicalText(String(s?.title || sections[i]?.title || '')),
      content: sanitizePedagogicalText(String(s?.content || sections[i]?.content || '')),
    }));

    console.log(`[v8-refine-content] Successfully refined ${sanitizedSections.length} sections`);

    return new Response(JSON.stringify({ sections: sanitizedSections }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[v8-refine-content] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
