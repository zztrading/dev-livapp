import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSpeakable, sha256Hex, buildCacheKey, getCachedJson, saveCachedJson, acquireInFlightLock, waitForCachedJson, logTtsUsage, assertVoiceAllowed } from "../_shared/tts-guard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * v10-process-anchors
 *
 * Processes [ANCHOR:*] tags in step narration scripts:
 * 1. Parses tags from the script
 * 2. Removes tags to produce clean text
 * 3. Sends clean text to ElevenLabs with-timestamps endpoint
 * 4. Matches anchor phrases to alignment timestamps
 * 5. Saves anchors to v10_lesson_step_anchors
 * 6. Updates step with audio_url
 * 7. Logs to pipeline
 *
 * Input:
 *   { pipeline_id, step_id, script, voice_id? }
 *
 * The script must contain [ANCHOR:*] tags. If no tags are found,
 * the function still generates audio but creates no anchors.
 */

const VOICE_ID_DEFAULT = 'Xb7hH8MSUJpSbSDYk0k2'; // Alice - PT-BR (padrão V8)
const MODEL_ID = 'eleven_multilingual_v2';
const VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.3,
  use_speaker_boost: true,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // Auth: require admin/supervisor role
    const { requireAdmin } = await import("../_shared/auth.ts");
    const authResult = await requireAdmin(req);
    if (authResult.error) return authResult.error;

    const { pipeline_id, step_id, script: scriptFromBody, voice_id } = await req.json();

    if (!pipeline_id || !step_id) {
      return jsonResponse({ error: 'pipeline_id and step_id are required' }, 400);
    }

    // Script can come from the request body or from the narration_script column
    let script = scriptFromBody;
    if (!script) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const tmpClient = createClient(supabaseUrl, supabaseServiceKey) as any;
      const { data: stepRow } = await tmpClient
        .from('v10_lesson_steps')
        .select('narration_script')
        .eq('id', step_id)
        .single();
      script = stepRow?.narration_script;
    }

    if (!script) {
      return jsonResponse({ error: 'No script provided and step has no narration_script' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY_1') || Deno.env.get('ELEVENLABS_API_KEY');

    if (!elevenLabsKey) {
      return jsonResponse({ error: 'ElevenLabs API key not configured' }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey) as any;
    const voiceId = voice_id || VOICE_ID_DEFAULT;

    const voiceCheck = await assertVoiceAllowed(supabase, voiceId);
    if (!voiceCheck.ok) return voiceCheck.response;

    // Import anchor utilities
    const { parseAnchorTags, removeAnchorTags, matchAnchorsToTimestamps } =
      await import("../_shared/anchor-utils.ts");

    console.log(`[v10-process-anchors] Processing step_id=${step_id}`);

    // ── Step 1: Parse tags ──────────────────────────────────────────────────
    const tags = parseAnchorTags(script);
    console.log(`[v10-process-anchors] Found ${tags.length} anchor tags`);

    // ── Step 2: Clean text ──────────────────────────────────────────────────
    const cleanText = removeAnchorTags(script);
    console.log(`[v10-process-anchors] Clean text: ${cleanText.length} chars`);

    // ── Guard: skip if not speakable ────────────────────────────────────────
    if (!isSpeakable(cleanText)) {
      console.log(`[v10-process-anchors] ⏭️ Skipped step ${step_id}: text not speakable`);
      await logPipeline(supabase, pipeline_id, 'process-anchors', 'skipped', {
        step_id,
        reason: 'not_speakable',
        clean_text_length: cleanText.length,
      });
      return jsonResponse({ skipped: true, reason: 'not_speakable', step_id });
    }

    // ── Step 3: ElevenLabs with-timestamps (com cache idempotente) ─────────
    const cacheKey = await buildCacheKey({
      endpoint: 'with-timestamps',
      voice_id: voiceId,
      model_id: MODEL_ID,
      voice_settings: VOICE_SETTINGS,
      text: cleanText,
    });
    let audio_base64: string | undefined;
    let alignment: any;
    let cacheHit = false;

    const logBase = {
      source_function: 'v10-process-anchors',
      endpoint: 'with-timestamps' as const,
      voice_id: voiceId,
      model_id: MODEL_ID,
      char_count: cleanText.length,
      request_hash: cacheKey,
      lesson_id: null as string | null,
    };

    const cached = await getCachedJson<{ audio_base64: string; alignment: any }>(supabase, cacheKey);
    if (cached?.audio_base64 && cached?.alignment) {
      audio_base64 = cached.audio_base64;
      alignment = cached.alignment;
      cacheHit = true;
      console.log(`[v10-process-anchors] ✅ cacheHit=true key=${cacheKey.slice(0, 12)}…`);
      logTtsUsage(supabase, { ...logBase, cache_hit: true });
    } else {
      const lock = await acquireInFlightLock(supabase, cacheKey);
      let waited: { audio_base64: string; alignment: any } | null = null;
      if (!lock.acquired) {
        waited = await waitForCachedJson<{ audio_base64: string; alignment: any }>(supabase, cacheKey);
      }
      if (waited?.audio_base64 && waited?.alignment) {
        audio_base64 = waited.audio_base64;
        alignment = waited.alignment;
        cacheHit = true;
        console.log(`[v10-process-anchors] ✅ cacheHit=true (após espera) key=${cacheKey.slice(0, 12)}…`);
        logTtsUsage(supabase, { ...logBase, cache_hit: true });
      } else {
        const fetchStart = Date.now();
        try {
          const elevenResponse = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
            {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'xi-api-key': elevenLabsKey,
              },
              body: JSON.stringify({
                text: cleanText,
                model_id: MODEL_ID,
                voice_settings: VOICE_SETTINGS,
              }),
            }
          );

          if (!elevenResponse.ok) {
            const errorText = await elevenResponse.text();
            console.error(`[v10-process-anchors] ElevenLabs error ${elevenResponse.status}:`, errorText);

            await logPipeline(supabase, pipeline_id, 'process-anchors', 'error', {
              step_id,
              error: `ElevenLabs ${elevenResponse.status}`,
              details: errorText.slice(0, 500),
            });

            return jsonResponse({
              error: `ElevenLabs returned ${elevenResponse.status}`,
              details: errorText.slice(0, 300),
            }, elevenResponse.status);
          }

          const elevenData = await elevenResponse.json();
          audio_base64 = elevenData.audio_base64;
          alignment = elevenData.alignment;

          if (!alignment || !alignment.characters) {
            return jsonResponse({ error: 'ElevenLabs did not return alignment data' }, 500);
          }

          // Salva no cache (não bloqueia em erro)
          await saveCachedJson(supabase, cacheKey, { audio_base64, alignment });
          console.log(`[v10-process-anchors] 💾 Cached key=${cacheKey.slice(0, 12)}…`);
          logTtsUsage(supabase, { ...logBase, cache_hit: false, elapsed_ms: Date.now() - fetchStart });
        } finally {
          if (lock.acquired) await lock.release();
        }
      }
    }

    console.log(`[v10-process-anchors] Audio ready: ${alignment.characters.length} chars (cacheHit=${cacheHit})`);

    // ── Step 4: Match anchors to timestamps ─────────────────────────────────
    let anchorResults: any[] = [];
    const matchErrors: string[] = [];

    if (tags.length > 0) {
      try {
        anchorResults = matchAnchorsToTimestamps(tags, {
          characters: alignment.characters,
          character_start_times_seconds: alignment.character_start_times_seconds,
          character_end_times_seconds: alignment.character_end_times_seconds,
        });
        console.log(`[v10-process-anchors] Matched ${anchorResults.length} anchors`);
      } catch (err: any) {
        matchErrors.push(err.message);
        console.error(`[v10-process-anchors] Match error:`, err.message);
      }
    }

    // ── Step 5: Upload audio ────────────────────────────────────────────────
    // Fetch step to get lesson_id for storage path
    const { data: stepData, error: stepError } = await supabase
      .from('v10_lesson_steps')
      .select('lesson_id, step_number')
      .eq('id', step_id)
      .single();

    if (stepError || !stepData) {
      return jsonResponse({ error: `Step not found: ${stepError?.message}` }, 404);
    }

    // 🛡️ Bloqueia regeneração em aulas v10 já publicadas
    {
      const { data: lessonRow } = await supabase
        .from('v10_lessons')
        .select('status')
        .eq('id', stepData.lesson_id)
        .maybeSingle();
      const status = String(lessonRow?.status || '').toLowerCase();
      const approved = new Set(['pronta', 'aprovada', 'approved', 'published', 'publicada', 'ativa', 'active']);
      if (approved.has(status)) {
        await logPipeline(supabase, pipeline_id, 'process-anchors', 'blocked', {
          step_id,
          reason: 'lesson_approved',
          status,
        });
        return jsonResponse({
          error: `Aula v10 ${stepData.lesson_id} está com status="${status}" — geração bloqueada.`,
          blocked: true,
        }, 409);
      }
    }

    const audioBuffer = Uint8Array.from(atob(audio_base64!), c => c.charCodeAt(0));
    const storagePath = `v10/${stepData.lesson_id}/step_${stepData.step_number}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from('lesson-audios')
      .upload(storagePath, audioBuffer.buffer as ArrayBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error(`[v10-process-anchors] Upload error:`, uploadError);
      return jsonResponse({ error: `Audio upload failed: ${uploadError.message}` }, 500);
    }

    const { data: urlData } = supabase.storage
      .from('lesson-audios')
      .getPublicUrl(storagePath);

    const audioUrl = urlData.publicUrl;

    // ── Step 6: Update step with audio_url ──────────────────────────────────
    const { error: updateStepError } = await supabase
      .from('v10_lesson_steps')
      .update({ audio_url: audioUrl })
      .eq('id', step_id);

    if (updateStepError) {
      console.error(`[v10-process-anchors] Step update error:`, updateStepError);
    }

    // ── Step 7: Save anchors ────────────────────────────────────────────────
    if (anchorResults.length > 0) {
      // Delete existing anchors for this step (idempotent)
      await supabase
        .from('v10_lesson_step_anchors')
        .delete()
        .eq('step_id', step_id);

      const anchorsToInsert = anchorResults.map((a: any) => ({
        step_id,
        anchor_type: a.anchor_type,
        timestamp_seconds: a.timestamp_seconds,
        match_phrase: a.match_phrase,
        label: a.label,
      }));

      const { error: insertError } = await supabase
        .from('v10_lesson_step_anchors')
        .insert(anchorsToInsert);

      if (insertError) {
        console.error(`[v10-process-anchors] Anchor insert error:`, insertError);
        matchErrors.push(`Insert failed: ${insertError.message}`);
      } else {
        console.log(`[v10-process-anchors] Saved ${anchorsToInsert.length} anchors`);
      }
    }

    // ── Step 8: Log to pipeline ─────────────────────────────────────────────
    const logStatus = matchErrors.length > 0 ? 'partial' : 'completed';
    await logPipeline(supabase, pipeline_id, 'process-anchors', logStatus, {
      step_id,
      step_number: stepData.step_number,
      tags_found: tags.length,
      anchors_saved: anchorResults.length,
      match_errors: matchErrors,
      audio_url: audioUrl,
    });

    return jsonResponse({
      success: true,
      step_id,
      audio_url: audioUrl,
      tags_found: tags.length,
      anchors_saved: anchorResults.length,
      match_errors: matchErrors,
    });
  } catch (error: any) {
    console.error('[v10-process-anchors] Error:', error);

    return jsonResponse({ error: error.message }, 500);
  }
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function logPipeline(
  supabase: any,
  pipeline_id: string,
  action: string,
  status: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase
      .from('v10_bpa_pipeline_log')
      .insert({
        pipeline_id,
        stage: 5,
        action: `${action}:${status}`,
        details: payload,
      });
  } catch (err) {
    console.error('[v10-process-anchors] Log error:', err);
  }
}
