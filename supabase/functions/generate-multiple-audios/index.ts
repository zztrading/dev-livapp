import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { isSpeakable, buildCacheKey, acquireInFlightLock, waitForCachedMp3, logTtsUsage, assertVoiceAllowed, requireLessonOrPreview } from '../_shared/tts-guard.ts';
import { requireAdmin } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL_ID = 'eleven_multilingual_v2';
const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true };

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function estimateAudioDuration(text: string): number {
  const words = text.split(/\s+/).length;
  return (words / 150) * 60;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { texts, voice_id, lesson_id, is_preview } = await req.json();

    const lessonCheck = requireLessonOrPreview({ lesson_id, is_preview });
    if (!lessonCheck.ok) return lessonCheck.response;
    if (!texts || !Array.isArray(texts)) {
      return new Response(JSON.stringify({ error: 'texts deve ser um array' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY não configurada');

    const voiceId = voice_id || 'Xb7hH8MSUJpSbSDYk0k2';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const voiceCheck = await assertVoiceAllowed(supabase, voiceId);
    if (!voiceCheck.ok) return voiceCheck.response;

    console.log(`🎵 Processando ${texts.length} áudios (com cache)...`);
    const results = [];
    let cacheHits = 0;

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (!isSpeakable(text)) {
        console.log(`⏭️ [${i + 1}/${texts.length}] skipped (não falável)`);
        results.push({ sectionId: `section-${i}`, audio_base64: '', duration: 0, cached: false, skipped: true });
        continue;
      }
      const cacheKey = await buildCacheKey({
        endpoint: 'text-to-speech',
        voice_id: voiceId,
        model_id: MODEL_ID,
        voice_settings: VOICE_SETTINGS,
        text,
      });

      // Check cache
      const { data: cached } = await supabase.storage
        .from('tts-cache')
        .download(`${cacheKey}.mp3`);

      const logBase = {
        source_function: 'generate-multiple-audios',
        endpoint: 'text-to-speech' as const,
        voice_id: voiceId,
        model_id: MODEL_ID,
        char_count: text.length,
        request_hash: cacheKey,
        lesson_id: null as string | null,
      };
      let audioBlob: ArrayBuffer;
      if (cached) {
        audioBlob = await cached.arrayBuffer();
        cacheHits++;
        console.log(`💾 [${i + 1}/${texts.length}] CACHE HIT`);
        logTtsUsage(supabase, { ...logBase, cache_hit: true });
      } else {
        const lock = await acquireInFlightLock(supabase, cacheKey);
        let waitedBuf: ArrayBuffer | null = null;
        if (!lock.acquired) {
          waitedBuf = await waitForCachedMp3(supabase, cacheKey);
        }
        if (waitedBuf) {
          audioBlob = waitedBuf;
          cacheHits++;
          console.log(`💾 [${i + 1}/${texts.length}] CACHE HIT (após espera)`);
          logTtsUsage(supabase, { ...logBase, cache_hit: true });
        } else {
          const fetchStart = Date.now();
          try {
            console.log(`🎤 [${i + 1}/${texts.length}] Gerando via ElevenLabs...`);
            const response = await fetch(
              `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
              {
                method: 'POST',
                headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text, model_id: MODEL_ID, language_code: 'pt', voice_settings: VOICE_SETTINGS,
                }),
              }
            );
            if (!response.ok) {
              const errorText = await response.text();
              logTtsUsage(supabase, { ...logBase, cache_hit: false, elapsed_ms: Date.now() - fetchStart, error: `ElevenLabs ${response.status}` });
              throw new Error(`ElevenLabs ${response.status}: ${errorText.slice(0, 200)}`);
            }
            audioBlob = await response.arrayBuffer();
            // Save cache (ignore race conflicts)
            await supabase.storage
              .from('tts-cache')
              .upload(`${cacheKey}.mp3`, new Uint8Array(audioBlob).buffer as ArrayBuffer, {
                contentType: 'audio/mpeg', upsert: false,
              }).catch(() => {});
            logTtsUsage(supabase, { ...logBase, cache_hit: false, elapsed_ms: Date.now() - fetchStart });
          } finally {
            if (lock.acquired) await lock.release();
          }
        }
      }

      results.push({
        sectionId: `section-${i}`,
        audio_base64: arrayBufferToBase64(audioBlob),
        duration: estimateAudioDuration(text),
        cached: !!cached,
      });
    }

    console.log(`🎉 ${results.length} prontos. Cache hits: ${cacheHits}/${texts.length}`);
    return new Response(JSON.stringify({ results, cacheHits }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
