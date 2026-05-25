import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

async function callAI(systemPrompt: string, userPrompt: string, model = 'google/gemini-2.5-flash'): Promise<string> {
  const resp = await fetch(AI_GATEWAY, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${t}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callAIStructured(systemPrompt: string, userPrompt: string, toolDef: any, model = 'google/gemini-2.5-flash'): Promise<any> {
  const resp = await fetch(AI_GATEWAY, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      tools: [{ type: 'function', function: toolDef }],
      tool_choice: { type: 'function', function: { name: toolDef.name } },
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${t}`);
  }
  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error('No tool call in AI response');
  return JSON.parse(toolCall.function.arguments);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders });
    }

    // Check admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { action } = body;

    // ============================================================
    // ACTION: RESET_ALL
    // ============================================================
    if (action === 'reset_all') {
      const { data, error } = await supabaseAdmin
        .from('exercise_audits')
        .update({
          audit_status: 'pending',
          errors_found: [],
          corrected_data: null,
          correction_reason: null,
          corrected_at: null,
          audited_at: null,
        })
        .neq('audit_status', 'applied')
        .select('id');

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        reset_count: Array.isArray(data) ? data.length : 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============================================================
    // ACTION: DISCOVER
    // ============================================================
    if (action === 'discover') {
      const { data: lessons, error: lessonsErr } = await supabaseAdmin
        .from('lessons')
        .select('id, title, is_active, content, trail_id')
        .not('trail_id', 'is', null);

      if (lessonsErr) throw lessonsErr;

      // Filter V8 lessons (have sections array in content)
      const v8Lessons = (lessons || []).filter((l: any) => {
        const c = l.content;
        return c && Array.isArray(c.sections) && c.sections.length > 0;
      });

      let totalDiscovered = 0;
      const records: any[] = [];

      for (const lesson of v8Lessons) {
        const content = lesson.content as any;
        const sections = content.sections || [];

        const getSectionInfo = (afterIdx: number) => {
          const s = sections[afterIdx];
          return {
            title: s?.title || `Seção ${afterIdx + 1}`,
            content: (s?.content || '').substring(0, 2500),
          };
        };

        // Extract inlineExercises (TOP-LEVEL content.inlineExercises)
        const inlineExercises = Array.isArray(content.inlineExercises) ? content.inlineExercises : [];
        for (const ex of inlineExercises) {
          if (!ex.id || !ex.type) continue;
          const si = ex.afterSectionIndex ?? 0;
          const sectionInfo = getSectionInfo(si);
          records.push({
            lesson_id: lesson.id,
            lesson_title: lesson.title,
            lesson_active: lesson.is_active ?? false,
            exercise_id: ex.id,
            section_index: si,
            section_title: sectionInfo.title,
            exercise_type: ex.type,
            exercise_data: ex,
            source_array: 'inlineExercises',
            section_content: sectionInfo.content,
          });
          totalDiscovered++;
        }

        // Extract inlineCompleteSentences (TOP-LEVEL content.inlineCompleteSentences)
        const completeSentences = Array.isArray(content.inlineCompleteSentences) ? content.inlineCompleteSentences : [];
        for (const ex of completeSentences) {
          if (!ex.id) continue;
          const exType = ex.type || 'complete-sentence';
          const si = ex.afterSectionIndex ?? 0;
          const sectionInfo = getSectionInfo(si);
          records.push({
            lesson_id: lesson.id,
            lesson_title: lesson.title,
            lesson_active: lesson.is_active ?? false,
            exercise_id: ex.id,
            section_index: si,
            section_title: sectionInfo.title,
            exercise_type: exType,
            exercise_data: ex,
            source_array: 'inlineCompleteSentences',
            section_content: sectionInfo.content,
          });
          totalDiscovered++;
        }
      }

      if (records.length > 0) {
        // Upsert: insert new exercises OR update section_content/metadata for existing ones
        // NOTE: ignoreDuplicates is FALSE so section_content gets refreshed (e.g. from 500→2500 chars)
        // Only columns in `records` are updated; audit_status/errors_found/corrected_data are NOT in records, so they're preserved
        const { error: upsertErr } = await supabaseAdmin
          .from('exercise_audits')
          .upsert(records, { onConflict: 'lesson_id,exercise_id' });
        if (upsertErr) throw upsertErr;
      }

      // Count actual pending after discover
      const { count: pendingCount } = await supabaseAdmin
        .from('exercise_audits')
        .select('id', { count: 'exact', head: true })
        .eq('audit_status', 'pending');

      return new Response(JSON.stringify({
        success: true,
        total_lessons: v8Lessons.length,
        total_exercises: totalDiscovered,
        pending_count: pendingCount || 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============================================================
    // ACTION: AUDIT — Pedagogical V2
    // ============================================================
    if (action === 'audit') {
      const batchSize = body.batch_size || 3;

      const { data: pending, error: pendingErr } = await supabaseAdmin
        .from('exercise_audits')
        .select('*')
        .eq('audit_status', 'pending')
        .order('created_at')
        .limit(batchSize);

      if (pendingErr) throw pendingErr;
      if (!pending || pending.length === 0) {
        return new Response(JSON.stringify({ success: true, audited: 0, remaining: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const auditToolDef = {
        name: 'audit_exercise',
        description: 'Pedagogical audit of an exercise against section content',
        parameters: {
          type: 'object',
          properties: {
            verdict: {
              type: 'string',
              enum: ['OK', 'LOGIC_INVERTED', 'WRONG_ANSWER', 'IRRELEVANT_STATEMENT', 'AMBIGUOUS'],
              description: 'OK if exercise is pedagogically correct, otherwise the specific error type',
            },
            correct_answer_is_right: {
              type: 'boolean',
              description: 'Whether the option/answer marked as correct is factually correct based on section content',
            },
            explanation: {
              type: 'string',
              description: 'Brief explanation of the verdict in Portuguese (1-2 sentences)',
            },
            is_clean: {
              type: 'boolean',
              description: 'true if verdict is OK, false otherwise',
            },
          },
          required: ['verdict', 'correct_answer_is_right', 'explanation', 'is_clean'],
        },
      };

      const systemPrompt = `Você é um auditor pedagógico RIGOROSO de exercícios interativos para uma plataforma educacional sobre IA.

SUA TAREFA: Verificar se as respostas marcadas como CORRETAS em cada exercício são FACTUALMENTE CORRETAS com base no conteúdo da seção que o aluno acabou de ler.

NÃO verifique apenas estrutura JSON. Verifique CONTEÚDO PEDAGÓGICO.

REGRAS POR TIPO DE EXERCÍCIO:

• flipcard-quiz: Cada card é uma UNIDADE INDEPENDENTE. O campo front.label indica O QUE está sendo avaliado naquele card (pode ser "Bancos de Imagem", "Midjourney", etc). Verifique se a opção com isCorrect=true corresponde ao que a seção diz sobre AQUELE assunto específico do card, não sobre a aula inteira. Se QUALQUER card tiver resposta errada, o exercício tem erro.

• true-false: Cada statement tem um campo "correct" (boolean). Verifique se o valor booleano corresponde à verdade factual descrita na seção.

• timed-quiz / multiple-choice: Verifique se a opção com isCorrect=true é factualmente correta baseado na seção. Se nenhuma opção é correta, ou se uma opção errada está marcada como correta, é erro.

• platform-match: Cada scenario tem correctPlatform. Verifique se a plataforma indicada faz sentido para o cenário descrito, com base no conteúdo da seção.

• complete-sentence: Verifique se os correctAnswers fazem sentido no contexto da frase e da seção.

• fill-in-blanks: Verifique se os correctAnswers completam a frase de forma factualmente correta.

• drag-drop: Verifique se os items estão associados às categories corretas.

• scenario-selection: Verifique se as opções marcadas como corretas fazem sentido para o cenário apresentado.

REGRA ESPECIAL: Se o section_content tem menos de 200 caracteres, retorne verdict=OK com explanation="Contexto insuficiente para auditoria pedagógica" (não há informação suficiente para julgar).

VERDICTS:
- OK: Exercício está pedagogicamente correto
- LOGIC_INVERTED: A resposta correta deveria ser outra opção (lógica invertida)
- WRONG_ANSWER: A opção marcada como correta é factualmente errada
- IRRELEVANT_STATEMENT: O enunciado/pergunta não tem relação com o conteúdo da seção
- AMBIGUOUS: Múltiplas opções poderiam ser consideradas corretas`;

      // ─────────────────────────────────────────────────────────────
      // 🚦 PEDAGOGICAL MINIMUMS — Etapa estrutural pré-IA
      // Detecta violações de cardinalidade ANTES da auditoria semântica.
      // Mesmo contrato usado em v8-generate-lesson-content/index.ts.
      // Documentado em mem://v8/contract/pedagogical-minimums-standard
      // ─────────────────────────────────────────────────────────────
      const PEDAGOGICAL_MINIMUMS: Record<string, Record<string, number>> = {
        'platform-match':     { platforms: 2, scenarios: 2 },
        'multiple-choice':    { options: 3 },
        'true-false':         { statements: 2 },
        'drag-drop':          { categories: 2, items: 3 },
        'flipcard-quiz':      { cards: 2 },
        'scenario-selection': { scenarios: 1 },
        'fill-in-blanks':     { sentences: 1 },
        'complete-sentence':  { sentences: 1 },
        'timed-quiz':         { questions: 2 },
      };

      const checkPedagogicalMinimums = (exerciseData: any, exerciseType: string) => {
        const rules = PEDAGOGICAL_MINIMUMS[exerciseType];
        if (!rules) return { ok: true, violations: [] as Array<{ field: string; expected: number; actual: number }> };
        // exerciseData may be the raw inline exercise (data nested) or already the data object
        const data = exerciseData?.data && typeof exerciseData.data === 'object' ? exerciseData.data : exerciseData || {};
        const violations: Array<{ field: string; expected: number; actual: number }> = [];
        for (const [field, expected] of Object.entries(rules)) {
          const arr = data?.[field];
          const actual = Array.isArray(arr) ? arr.length : 0;
          if (actual < expected) violations.push({ field, expected, actual });
        }
        return { ok: violations.length === 0, violations };
      };

      let auditedCount = 0;
      let structuralFailedCount = 0;
      for (const audit of pending) {
        try {
          // Step 1: Structural check (no AI cost)
          const structural = checkPedagogicalMinimums(audit.exercise_data, audit.exercise_type);
          if (!structural.ok) {
            const errorsFound = structural.violations.map(v => ({
              verdict: 'PEDAGOGICAL_MINIMUM',
              type: 'pedagogical_minimum',
              explanation: `Campo "${v.field}" tem ${v.actual} item(ns), mínimo pedagógico é ${v.expected}.`,
              expected: v.expected,
              actual: v.actual,
              field: v.field,
            }));
            await supabaseAdmin
              .from('exercise_audits')
              .update({
                audit_status: 'has_errors',
                errors_found: errorsFound,
                audited_at: new Date().toISOString(),
              })
              .eq('id', audit.id);
            structuralFailedCount++;
            auditedCount++;
            console.warn(`[audit] Structural fail ${audit.exercise_id} (${audit.exercise_type}): ${JSON.stringify(structural.violations)}`);
            continue;
          }

          // Step 2: Semantic AI audit (only if structurally valid)
          const sectionContent = audit.section_content || '';
          const userPrompt = `CONTEÚDO DA SEÇÃO (o que o aluno acabou de aprender):
"""
${sectionContent}
"""

EXERCÍCIO A AVALIAR:
Tipo: ${audit.exercise_type}
ID: ${audit.exercise_id}

JSON do exercício:
${JSON.stringify(audit.exercise_data, null, 2)}

Baseando-se EXCLUSIVAMENTE no conteúdo da seção acima, avalie se as respostas marcadas como corretas são factualmente corretas.`;

          const result = await callAIStructured(systemPrompt, userPrompt, auditToolDef);

          const errorsFound = result.is_clean ? [] : [{
            verdict: result.verdict,
            explanation: result.explanation,
            correct_answer_is_right: result.correct_answer_is_right,
          }];

          await supabaseAdmin
            .from('exercise_audits')
            .update({
              audit_status: result.is_clean ? 'clean' : 'has_errors',
              errors_found: errorsFound,
              audited_at: new Date().toISOString(),
            })
            .eq('id', audit.id);

          auditedCount++;
        } catch (err: any) {
          console.error(`[audit] Error auditing ${audit.exercise_id}:`, err.message);
          await supabaseAdmin
            .from('exercise_audits')
            .update({
              audit_status: 'has_errors',
              errors_found: [{ verdict: 'AMBIGUOUS', explanation: `Falha na auditoria: ${err.message}`, correct_answer_is_right: false }],
              audited_at: new Date().toISOString(),
            })
            .eq('id', audit.id);
          auditedCount++;
        }
      }

      // Count remaining
      const { count } = await supabaseAdmin
        .from('exercise_audits')
        .select('id', { count: 'exact', head: true })
        .eq('audit_status', 'pending');

      return new Response(JSON.stringify({
        success: true,
        audited: auditedCount,
        structural_failed: structuralFailedCount,
        remaining: count || 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============================================================
    // ACTION: CORRECT — With section_content + metadata preservation
    // ============================================================
    if (action === 'correct') {
      const batchSize = body.batch_size || 3;
      const adminInstruction = body.admin_instruction || '';

      const { data: errored, error: erroredErr } = await supabaseAdmin
        .from('exercise_audits')
        .select('*')
        .eq('audit_status', 'has_errors')
        .order('created_at')
        .limit(batchSize);

      if (erroredErr) throw erroredErr;
      if (!errored || errored.length === 0) {
        return new Response(JSON.stringify({ success: true, corrected: 0, remaining: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const systemPrompt = `Você é um especialista em design instrucional para adultos 35+.
Corrija o exercício mantendo o mesmo formato JSON e tipo.

REGRAS OBRIGATÓRIAS:
- Mantenha id, type e estrutura do exercício (NUNCA altere o id)
- A resposta correta DEVE refletir o que a seção ensina
- Se instruction está vazia em timed-quiz, gere uma instrução contextualizada
- Use a mesma terminologia do conteúdo da seção
- Escreva em português brasileiro, tom direto e claro
- Deve haver apenas UMA opção claramente correta
- As opções incorretas devem ser plausíveis mas erradas para quem leu a seção
- multiple-choice com options [{id,text,isCorrect}] é formato VÁLIDO, mantenha-o
- complete-sentence onde options === correctAnswers é INTENCIONAL
${adminInstruction ? `\nINSTRUÇÃO DO ADMIN: ${adminInstruction}` : ''}

IMPORTANTE: Retorne APENAS o JSON do exercício corrigido, sem markdown, sem \`\`\`, sem explicações.`;

      let correctedCount = 0;
      let appliedCount = 0;

      for (const audit of errored) {
        try {
          const errors = audit.errors_found as any[];
          const errorExplanation = errors.map((e: any) => `${e.verdict || 'ERROR'}: ${e.explanation || e.description || ''}`).join('; ');

          const userPrompt = `CONTEÚDO DA SEÇÃO (contexto pedagógico obrigatório):
"""
${audit.section_content || 'N/A'}
"""

EXERCÍCIO COM PROBLEMA (tipo: ${audit.exercise_type}):
${JSON.stringify(audit.exercise_data, null, 2)}

PROBLEMA IDENTIFICADO:
${errorExplanation}

Reescreva este exercício corrigindo o problema. A resposta correta DEVE estar alinhada com o que a seção ensina.`;

          const correctedText = await callAI(systemPrompt, userPrompt, 'google/gemini-2.5-pro');

          // Parse the corrected JSON
          let correctedData: any;
          try {
            const jsonMatch = correctedText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, correctedText];
            correctedData = JSON.parse(jsonMatch[1]!.trim());
          } catch {
            console.error(`[correct] Failed to parse AI response for ${audit.exercise_id}`);
            await supabaseAdmin.from('exercise_audits').update({
              audit_status: 'correction_failed',
              correction_reason: 'AI returned unparseable JSON',
            }).eq('id', audit.id);
            continue;
          }

          // Validate basic structure
          if (!correctedData.id || !correctedData.type) {
            console.error(`[correct] Invalid corrected data for ${audit.exercise_id}`);
            await supabaseAdmin.from('exercise_audits').update({
              audit_status: 'correction_failed',
              correction_reason: `AI returned invalid structure (missing id or type)`,
            }).eq('id', audit.id);
            continue;
          }

          const reason = errorExplanation;

          // Auto-apply to lesson
          const { data: lesson } = await supabaseAdmin
            .from('lessons')
            .select('content')
            .eq('id', audit.lesson_id)
            .single();

          if (lesson) {
            const content = lesson.content as any;
            const sourceArray = audit.source_array as string;
            let applied = false;

            const targetKey = sourceArray === 'inlineCompleteSentences' 
              ? 'inlineCompleteSentences' : 'inlineExercises';
            const arr = content[targetKey];
            if (Array.isArray(arr)) {
              const idx = arr.findIndex((ex: any) => ex.id === audit.exercise_id);
              if (idx !== -1) {
                // Preserve afterSectionIndex and other positional metadata
                const original = arr[idx];
                arr[idx] = { ...correctedData, afterSectionIndex: original.afterSectionIndex };
                applied = true;
              }
            }

            if (applied) {
              const { error: updateErr } = await supabaseAdmin
                .from('lessons')
                .update({ content })
                .eq('id', audit.lesson_id);

              if (!updateErr) {
                appliedCount++;
                correctedCount++;
                await supabaseAdmin
                  .from('exercise_audits')
                  .update({
                    corrected_data: correctedData,
                    correction_reason: reason,
                    corrected_at: new Date().toISOString(),
                    audit_status: 'applied',
                    applied_at: new Date().toISOString(),
                    applied_by: user.id,
                  })
                  .eq('id', audit.id);
              } else {
                console.error(`[correct] Failed to update lesson ${audit.lesson_id}:`, updateErr);
                await supabaseAdmin
                  .from('exercise_audits')
                  .update({
                    corrected_data: correctedData,
                    correction_reason: reason,
                    corrected_at: new Date().toISOString(),
                    audit_status: 'corrected',
                  })
                  .eq('id', audit.id);
                correctedCount++;
              }
            } else {
              await supabaseAdmin.from('exercise_audits').update({
                audit_status: 'correction_failed',
                correction_reason: 'Exercise not found in lesson content at expected path',
                corrected_data: correctedData,
              }).eq('id', audit.id);
            }
          }
        } catch (err: any) {
          console.error(`[correct] Error correcting ${audit.exercise_id}:`, err.message);
        }
      }

      const { count } = await supabaseAdmin
        .from('exercise_audits')
        .select('id', { count: 'exact', head: true })
        .eq('audit_status', 'has_errors');

      return new Response(JSON.stringify({
        success: true,
        corrected: correctedCount,
        applied: appliedCount,
        remaining: count || 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============================================================
    // ACTION: APPLY (manual override)
    // ============================================================
    if (action === 'apply') {
      const { audit_id, corrected_data } = body;
      if (!audit_id || !corrected_data) {
        return new Response(JSON.stringify({ error: 'Missing audit_id or corrected_data' }), {
          status: 400, headers: corsHeaders,
        });
      }

      const { data: audit, error: auditErr } = await supabaseAdmin
        .from('exercise_audits')
        .select('*')
        .eq('id', audit_id)
        .single();

      if (auditErr || !audit) {
        return new Response(JSON.stringify({ error: 'Audit not found' }), {
          status: 404, headers: corsHeaders,
        });
      }

      const { data: lesson } = await supabaseAdmin
        .from('lessons')
        .select('content')
        .eq('id', audit.lesson_id)
        .single();

      if (!lesson) {
        return new Response(JSON.stringify({ error: 'Lesson not found' }), {
          status: 404, headers: corsHeaders,
        });
      }

      const content = lesson.content as any;
      const sourceArray = audit.source_array as string;
      let applied = false;

      const targetKey = sourceArray === 'inlineCompleteSentences' 
        ? 'inlineCompleteSentences' : 'inlineExercises';
      const targetArr = content[targetKey];
      if (Array.isArray(targetArr)) {
        const idx = targetArr.findIndex((ex: any) => ex.id === audit.exercise_id);
        if (idx !== -1) {
          // Preserve afterSectionIndex
          const original = targetArr[idx];
          targetArr[idx] = { ...corrected_data, afterSectionIndex: original.afterSectionIndex };
          applied = true;
        }
      }

      if (!applied) {
        return new Response(JSON.stringify({ error: 'Exercise not found in lesson content' }), {
          status: 404, headers: corsHeaders,
        });
      }

      const { error: updateErr } = await supabaseAdmin
        .from('lessons')
        .update({ content })
        .eq('id', audit.lesson_id);

      if (updateErr) {
        return new Response(JSON.stringify({ error: 'Failed to update lesson', details: updateErr }), {
          status: 500, headers: corsHeaders,
        });
      }

      await supabaseAdmin
        .from('exercise_audits')
        .update({
          corrected_data,
          audit_status: 'applied',
          applied_at: new Date().toISOString(),
          applied_by: user.id,
        })
        .eq('id', audit_id);

      return new Response(JSON.stringify({ success: true, applied: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============================================================
    // ACTION: RE-CORRECT (AI re-generation with admin instruction)
    // ============================================================
    if (action === 're-correct') {
      const { audit_id, admin_instruction } = body;
      if (!audit_id || !admin_instruction) {
        return new Response(JSON.stringify({ error: 'Missing audit_id or admin_instruction' }), {
          status: 400, headers: corsHeaders,
        });
      }

      const { data: audit, error: auditErr } = await supabaseAdmin
        .from('exercise_audits')
        .select('*')
        .eq('id', audit_id)
        .single();

      if (auditErr || !audit) {
        return new Response(JSON.stringify({ error: 'Audit not found' }), {
          status: 404, headers: corsHeaders,
        });
      }

      const currentData = audit.corrected_data || audit.exercise_data;

      const systemPrompt = `Você é um especialista em exercícios interativos para uma plataforma educacional sobre IA.
Modifique o exercício conforme a instrução do administrador.
Retorne APENAS o JSON do exercício corrigido, sem markdown, sem \`\`\`, sem explicações.
Mantenha id, type e a estrutura geral do exercício.`;

      const userPrompt = `CONTEÚDO DA SEÇÃO (contexto pedagógico):
"""
${audit.section_content || 'N/A'}
"""

Exercício atual (tipo: ${audit.exercise_type}):
${JSON.stringify(currentData, null, 2)}

INSTRUÇÃO DO ADMIN: ${admin_instruction}`;

      const correctedText = await callAI(systemPrompt, userPrompt, 'google/gemini-2.5-pro');

      let correctedData: any;
      try {
        const jsonMatch = correctedText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, correctedText];
        correctedData = JSON.parse(jsonMatch[1]!.trim());
      } catch {
        return new Response(JSON.stringify({ error: 'Failed to parse AI response', raw: correctedText.substring(0, 500) }), {
          status: 500, headers: corsHeaders,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        corrected_data: correctedData,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: corsHeaders,
    });

  } catch (err: any) {
    console.error('[v8-audit-exercises] Error:', err);
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500, headers: corsHeaders,
    });
  }
});
