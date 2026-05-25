import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { isSpeakable, buildCacheKey, getCachedMp3, saveCachedMp3, logTtsUsage, assertVoiceAllowed } from "../_shared/tts-guard.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * ElevenLabs TTS Contextual - Gera áudio de sussurros/hints para interações V7
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  try {
    const { text, texts, voiceId, whisper } = await req.json();
    
    // API Key from secrets (connector provides this as ELEVENLABS_API_KEY_1)
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY_1') || Deno.env.get('ELEVENLABS_API_KEY');
    
    if (!ELEVENLABS_API_KEY) {
      console.error('[elevenlabs-tts-contextual] ❌ No API key found');
      return new Response(
        JSON.stringify({ error: 'ElevenLabs API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrlForCache = Deno.env.get('SUPABASE_URL');
    const supabaseKeyForCache = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseForCache = (supabaseUrlForCache && supabaseKeyForCache)
      ? createClient(supabaseUrlForCache, supabaseKeyForCache)
      : null;

    // Valida voz contra allowlist no handler para retornar 403/503 corretos
    // em vez de virar 500 via throw dentro do generateAudio.
    const effectiveVoice = voiceId || 'Xb7hH8MSUJpSbSDYk0k2';
    if (supabaseForCache) {
      const voiceCheck = await assertVoiceAllowed(supabaseForCache, effectiveVoice);
      if (!voiceCheck.ok) return voiceCheck.response;
    }

    // Batch mode
    if (texts && Array.isArray(texts)) {
      console.log(`[elevenlabs-tts-contextual] 🎵 Generating ${texts.length} contextual audios`);

      const results = await Promise.all(
        texts.map(async (t: string, index: number) => {
          try {
            const audioBase64 = await generateAudio(t, voiceId, whisper, ELEVENLABS_API_KEY, supabaseForCache);
            return { index, text: t, audioBase64, success: true };
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error(`[elevenlabs-tts-contextual] ❌ Error generating audio ${index}:`, err);
            return { index, text: t, error: errorMessage, success: false };
          }
        })
      );

      return new Response(
        JSON.stringify({ results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Single text mode
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[elevenlabs-tts-contextual] 🎵 Generating audio for: "${text.substring(0, 50)}..."`);

    const audioBase64 = await generateAudio(text, voiceId, whisper, ELEVENLABS_API_KEY, supabaseForCache);
    
    return new Response(
      JSON.stringify({ audioBase64 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[elevenlabs-tts-contextual] ❌ Error:', err);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateAudio(
  text: string,
  voiceId?: string,
  whisper?: boolean,
  apiKey?: string,
  supabase?: any,
): Promise<string> {
  if (!isSpeakable(text)) {
    throw new Error('Texto não falável após sanitização — chamada bloqueada');
  }

  // Alice (Xb7hH8MSUJpSbSDYk0k2) - voz padrão global
  // Se voiceId for passado, usar ele; senão usar Alice
  // Validação contra allowlist é feita no handler antes de chegar aqui.
  const voice = voiceId || 'Xb7hH8MSUJpSbSDYk0k2'; // Alice — padrão global

  // Voice settings para efeito de sussurro (mesma voz, configurações diferentes)
  const voiceSettings = whisper
    ? {
        stability: 0.85,       // Alta estabilidade para sussurro consistente
        similarity_boost: 0.8, // Manter similaridade com a voz original
        style: 0.2,           // Estilo baixo para tom mais intimista
        use_speaker_boost: false, // Sem boost para som mais suave
        speed: 0.9            // Levemente mais lento para sussurro
      }
    : {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.5,
        use_speaker_boost: true
      };

  const MODEL_ID = 'eleven_multilingual_v2';
  const OUTPUT_FORMAT = 'mp3_44100_128';

  const cacheKey = await buildCacheKey({
    endpoint: 'text-to-speech',
    voice_id: voice,
    model_id: MODEL_ID,
    output_format: OUTPUT_FORMAT,
    voice_settings: voiceSettings,
    text,
  });

  const logBase = {
    source_function: 'elevenlabs-tts-contextual',
    endpoint: 'text-to-speech' as const,
    voice_id: voice,
    model_id: MODEL_ID,
    output_format: OUTPUT_FORMAT,
    char_count: text.length,
    request_hash: cacheKey,
    lesson_id: null as string | null,
  };

  let audioBuffer: ArrayBuffer | null = supabase ? await getCachedMp3(supabase, cacheKey) : null;
  if (audioBuffer) {
    console.log(`💾 [elevenlabs-tts-contextual] cache HIT — key=${cacheKey.slice(0, 12)}…`);
    if (supabase) logTtsUsage(supabase, { ...logBase, cache_hit: true });
  } else {
    const fetchStart = Date.now();
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: MODEL_ID,
          language_code: 'pt',
          output_format: OUTPUT_FORMAT,
          voice_settings: voiceSettings,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[elevenlabs-tts-contextual] ❌ ElevenLabs API error:', response.status, errorText);
      if (supabase) logTtsUsage(supabase, { ...logBase, cache_hit: false, elapsed_ms: Date.now() - fetchStart, error: `ElevenLabs ${response.status}` });
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    audioBuffer = await response.arrayBuffer();
    if (supabase) await saveCachedMp3(supabase, cacheKey, audioBuffer);
    console.log(`[elevenlabs-tts-contextual] ✅ Generated ${(audioBuffer.byteLength / 1024).toFixed(1)}KB audio (voice: ${voice})`);
    if (supabase) logTtsUsage(supabase, { ...logBase, cache_hit: false, elapsed_ms: Date.now() - fetchStart });
  }

  if (!audioBuffer) throw new Error('audio buffer empty');
  return base64Encode(audioBuffer);
}
