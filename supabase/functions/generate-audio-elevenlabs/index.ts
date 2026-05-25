import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isSpeakable, buildCacheKey, getCachedJson, saveCachedJson, logTtsUsage, assertVoiceAllowed, requireLessonOrPreview } from '../_shared/tts-guard.ts';
import { requireAdmin } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { text, voice_id, model_id, lesson_id, is_preview } = await req.json();

    const lessonCheck = requireLessonOrPreview({ lesson_id, is_preview });
    if (!lessonCheck.ok) return lessonCheck.response;
    
    // Validações
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Texto é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'API Key do ElevenLabs não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Voice ID padrão: Alice (Xb7hH8MSUJpSbSDYk0k2)
    const voiceId = voice_id || 'Xb7hH8MSUJpSbSDYk0k2';

    // Model ID padrão: eleven_multilingual_v2 (padrão Alice global)
    const modelId = model_id || 'eleven_multilingual_v2';

    // Cria client antes para validação de voz contra allowlist.
    const supabaseUrlForCheck = Deno.env.get('SUPABASE_URL');
    const supabaseKeyForCheck = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseForCheck = (supabaseUrlForCheck && supabaseKeyForCheck)
      ? createClient(supabaseUrlForCheck, supabaseKeyForCheck)
      : null;
    const voiceCheck = await assertVoiceAllowed(supabaseForCheck, voiceId);
    if (!voiceCheck.ok) return voiceCheck.response;

    console.log('Gerando áudio com ElevenLabs (com timestamps)...');
    console.log('Voice ID:', voiceId);
    console.log('Model ID:', modelId);
    console.log('Text length:', text.length);
    console.log('Lesson ID:', lesson_id || 'não fornecido');

    if (!isSpeakable(text)) {
      return new Response(
        JSON.stringify({ error: 'Texto não falável após sanitização — chamada bloqueada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const VOICE_SETTINGS = {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.3,
      use_speaker_boost: true,
    };

    const supabaseUrlForCache = Deno.env.get('SUPABASE_URL');
    const supabaseKeyForCache = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseForCache = (supabaseUrlForCache && supabaseKeyForCache)
      ? createClient(supabaseUrlForCache, supabaseKeyForCache)
      : null;

    const cacheKey = await buildCacheKey({
      endpoint: 'with-timestamps',
      voice_id: voiceId,
      model_id: modelId,
      voice_settings: VOICE_SETTINGS,
      text,
    });

    let data: any = supabaseForCache ? await getCachedJson(supabaseForCache, cacheKey) : null;
    let cacheHit = !!data;
    const logBase = {
      source_function: 'generate-audio-elevenlabs',
      endpoint: 'with-timestamps' as const,
      voice_id: voiceId,
      model_id: modelId,
      char_count: text.length,
      request_hash: cacheKey,
      lesson_id: lesson_id ?? null,
    };
    const fetchStart = Date.now();

    if (!data) {
      // Chamar API do ElevenLabs COM TIMESTAMPS
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json', // IMPORTANTE: JSON para receber timestamps
            'Content-Type': 'application/json',
            'xi-api-key': ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            text: text,
            model_id: modelId,
            language_code: 'pt',
            voice_settings: VOICE_SETTINGS,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('ElevenLabs API error:', response.status, error);
        if (supabaseForCache) logTtsUsage(supabaseForCache, { ...logBase, cache_hit: false, elapsed_ms: Date.now() - fetchStart, error: `ElevenLabs ${response.status}` });
        return new Response(
          JSON.stringify({
            error: 'Falha ao gerar áudio',
            details: error,
            status: response.status
          }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      data = await response.json();
      if (supabaseForCache) {
        saveCachedJson(supabaseForCache, cacheKey, data).catch(() => {});
        logTtsUsage(supabaseForCache, { ...logBase, cache_hit: false, elapsed_ms: Date.now() - fetchStart });
      }
    } else {
      console.log(`💾 [generate-audio-elevenlabs] cache HIT — key=${cacheKey.slice(0, 12)}…`);
      if (supabaseForCache) logTtsUsage(supabaseForCache, { ...logBase, cache_hit: true });
    }
    
    // Extrair áudio e timestamps
    const audioBase64 = data.audio_base64;
    const alignment = data.alignment;
    
    if (!audioBase64) {
      console.error('Resposta sem áudio:', data);
      return new Response(
        JSON.stringify({ error: 'Resposta da API sem áudio' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Áudio gerado com sucesso. Tamanho:', audioBase64.length, 'chars base64');
    
    // Processar timestamps se disponíveis
    let wordTimestamps: Array<{word: string; start: number; end: number}> = [];
    if (alignment?.characters && alignment?.character_start_times_seconds && 
        alignment.characters.length > 0 && alignment.character_start_times_seconds.length > 0) {
      console.log('Processando', alignment.characters.length, 'timestamps de caracteres...');
      wordTimestamps = processWordTimestamps(
        alignment.characters, 
        alignment.character_start_times_seconds
      );
      console.log('✅ Timestamps processados:', wordTimestamps.length, 'palavras');
      
      // Log das primeiras 5 palavras para debug
      console.log('Primeiras 5 palavras:', wordTimestamps.slice(0, 5));
      
      // Salvar timestamps no banco se lesson_id fornecido
      if (lesson_id) {
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          // Fazer upload do áudio para storage
          const audioBuffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
          const fileName = `lesson-${lesson_id}-${Date.now()}.mp3`;
          
          const { error: uploadError } = await supabase.storage
            .from('lesson-audios')
            .upload(fileName, audioBuffer, {
              contentType: 'audio/mpeg',
              upsert: true
            });
          
          if (uploadError) {
            console.error('Erro ao fazer upload do áudio:', uploadError);
          } else {
            console.log('✅ Áudio salvo no storage:', fileName);
            
            // Pegar URL pública
            const { data: urlData } = supabase.storage
              .from('lesson-audios')
              .getPublicUrl(fileName);
            
            // Atualizar lesson com audio_url e timestamps
            const { error: updateError } = await supabase
              .from('lessons')
              .update({ 
                audio_url: urlData.publicUrl,
                word_timestamps: wordTimestamps 
              })
              .eq('id', lesson_id);
            
            if (updateError) {
              console.error('Erro ao atualizar lesson:', updateError);
            } else {
              console.log('✅ Lesson atualizada com audio_url e timestamps');
            }
          }
        } catch (err) {
          console.error('Erro ao salvar no banco:', err);
        }
      }
    } else {
      console.warn('⚠️ Nenhum timestamp recebido da API');
    }
    
    // Retornar JSON com audio_base64 e timestamps para o frontend processar também
    return new Response(
      JSON.stringify({
        audio_base64: audioBase64,
        word_timestamps: wordTimestamps,
        total_words: wordTimestamps.length
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
    
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper: Processar timestamps de caracteres para palavras completas
function processWordTimestamps(
  characters: string[], 
  characterStartTimes: number[]
): Array<{word: string; start: number; end: number}> {
  const words: Array<{word: string; start: number; end: number}> = [];
  let currentWord = '';
  let wordStartIndex = 0;
  
  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    
    if (char === ' ' || char === '\n' || i === characters.length - 1) {
      // Se é o último caractere e não é espaço, adiciona ao word atual
      if (i === characters.length - 1 && char !== ' ' && char !== '\n') {
        currentWord += char;
      }
      
      if (currentWord.trim().length > 0) {
        const cleanWord = currentWord.trim();
        const startTime = characterStartTimes[wordStartIndex];
        const endTime = i < characters.length - 1 
          ? characterStartTimes[i]
          : characterStartTimes[characterStartTimes.length - 1];
        
        words.push({
          word: cleanWord,
          start: startTime,
          end: endTime
        });
      }
      
      currentWord = '';
      wordStartIndex = i + 1;
    } else {
      currentWord += char;
    }
  }
  
  return words;
}
