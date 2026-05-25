// =============================================================================
// TTS Guardrails — bloqueia desperdício e protege aulas aprovadas
// =============================================================================
// 1. isSpeakable(text): só passa texto que tem conteúdo falável real.
// 2. sha256Hex(s): chave de cache determinística.
// 3. cache helpers: MP3 binário + JSON com timestamps em bucket "tts-cache".
// 4. assertLessonNotApproved: aborta antes de qualquer geração que
//    pudesse sobrescrever áudio de uma aula aprovada / ativa / publicada.
// =============================================================================

export async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Cache key canônica (usada por TODAS as funções TTS) ────────────────────
// Inclui todos os campos que afetam o output do ElevenLabs.
// Mudar a forma desta string invalida o cache anterior — não alterar sem
// migração planejada.
export interface TtsCacheKeyInput {
  endpoint: 'text-to-speech' | 'with-timestamps';
  voice_id: string;
  model_id: string;
  text: string;
  output_format?: string;
  audio_speed?: number;
  voice_settings?: unknown;
  // Request stitching (previous_text/next_text) altera prosódia do output —
  // precisa entrar na chave para garantir hit correto.
  previous_text?: string;
  next_text?: string;
  // Para idiomas/configs adicionais que afetem o output futuramente.
  extra?: string;
}

export async function buildCacheKey(input: TtsCacheKeyInput): Promise<string> {
  const parts = [
    input.endpoint,
    input.voice_id,
    input.model_id,
    input.output_format ?? '',
    input.audio_speed != null ? String(input.audio_speed) : '',
    input.voice_settings != null ? JSON.stringify(input.voice_settings) : '',
    input.previous_text ?? '',
    input.next_text ?? '',
    input.extra ?? '',
    input.text,
  ];
  return await sha256Hex(parts.join('|'));
}

const STRIP_REGEXES: Array<[RegExp, string]> = [
  [/\[ANCHOR:[^\]]*\]/gi, ''],
  [/\[AI_IMAGE[^\]]*\]/gi, ''],
  [/\[\/?[a-z][^\]]{0,40}\]/gi, ''], // qualquer tag [foo], [/bar]
  [/<[^>]+>/g, ''],                  // HTML
  [/[*_`#>~|]+/g, ''],               // markdown leve
  [/!\[[^\]]*\]\([^)]*\)/g, ''],     // imagens markdown
  [/\[[^\]]*\]\([^)]*\)/g, ''],      // links markdown
];

export function stripForSpeakability(text: string): string {
  if (!text) return '';
  let out = String(text);
  for (const [r, rep] of STRIP_REGEXES) out = out.replace(r, rep);
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

/**
 * Retorna true só se o texto, depois de limpo, tiver conteúdo falável real.
 * Mínimos: 3 caracteres alfanuméricos (anti `?`, `...`, ` `, `[ANCHOR:1]`).
 */
export function isSpeakable(text: unknown): boolean {
  if (typeof text !== 'string') return false;
  const stripped = stripForSpeakability(text);
  if (!stripped) return false;
  const alpha = (stripped.match(/[\p{L}\p{N}]/gu) || []).length;
  return alpha >= 3;
}

// ─── Cache helpers ──────────────────────────────────────────────────────────

const CACHE_BUCKET = 'tts-cache';

export async function getCachedMp3(
  supabase: any,
  key: string,
): Promise<ArrayBuffer | null> {
  try {
    const { data } = await supabase.storage.from(CACHE_BUCKET).download(`${key}.mp3`);
    if (!data) return null;
    return await data.arrayBuffer();
  } catch {
    return null;
  }
}

export async function saveCachedMp3(
  supabase: any,
  key: string,
  buf: ArrayBuffer,
): Promise<void> {
  try {
    await supabase.storage.from(CACHE_BUCKET).upload(
      `${key}.mp3`,
      new Uint8Array(buf).buffer as ArrayBuffer,
      { contentType: 'audio/mpeg', upsert: false },
    );
  } catch {
    // race condition / already exists — ok
  }
}

export async function getCachedJson<T = unknown>(
  supabase: any,
  key: string,
): Promise<T | null> {
  try {
    const { data } = await supabase.storage.from(CACHE_BUCKET).download(`${key}.json`);
    if (!data) return null;
    const txt = await data.text();
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

export async function saveCachedJson(
  supabase: any,
  key: string,
  payload: unknown,
): Promise<void> {
  try {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    await supabase.storage.from(CACHE_BUCKET).upload(
      `${key}.json`,
      blob,
      { contentType: 'application/json', upsert: false },
    );
  } catch {
    // already exists — ok
  }
}

// ─── In-flight lock (idempotência entre requests concorrentes) ──────────────
// Quando duas requests com o mesmo hash chegam simultaneamente e nenhuma
// das duas vê cache, ambas chamariam ElevenLabs. O lock garante que só uma
// chama; a outra espera o cache popular.

const LOCK_TTL_MS = 30_000;
const POLL_INTERVAL_MS = 500;
const DEFAULT_MAX_WAIT_MS = 25_000;

export interface InFlightLock {
  acquired: boolean;
  release: () => Promise<void>;
}

export async function acquireInFlightLock(
  supabase: any,
  key: string,
): Promise<InFlightLock> {
  const lockPath = `${key}.lock`;
  try {
    const blob = new Blob([String(Date.now())], { type: 'text/plain' });
    const { error } = await supabase.storage.from(CACHE_BUCKET).upload(
      lockPath,
      blob,
      { contentType: 'text/plain', upsert: false },
    );
    if (error) {
      // Lock já existe — outra request está em curso.
      // Verifica se está stale (TTL expirado) e tenta tomar.
      try {
        const { data } = await supabase.storage.from(CACHE_BUCKET).download(lockPath);
        if (data) {
          const ts = parseInt(await data.text(), 10);
          if (Number.isFinite(ts) && Date.now() - ts > LOCK_TTL_MS) {
            await supabase.storage.from(CACHE_BUCKET).remove([lockPath]);
            return acquireInFlightLock(supabase, key);
          }
        }
      } catch {/* ignore */}
      return { acquired: false, release: async () => {} };
    }
    return {
      acquired: true,
      release: async () => {
        try { await supabase.storage.from(CACHE_BUCKET).remove([lockPath]); } catch {/* ignore */}
      },
    };
  } catch {
    return { acquired: false, release: async () => {} };
  }
}

export async function waitForCachedMp3(
  supabase: any,
  key: string,
  maxWaitMs: number = DEFAULT_MAX_WAIT_MS,
): Promise<ArrayBuffer | null> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const cached = await getCachedMp3(supabase, key);
    if (cached) return cached;
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  return null;
}

export async function waitForCachedJson<T = unknown>(
  supabase: any,
  key: string,
  maxWaitMs: number = DEFAULT_MAX_WAIT_MS,
): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const cached = await getCachedJson<T>(supabase, key);
    if (cached) return cached;
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  return null;
}

// ─── Voice allowlist ────────────────────────────────────────────────────────
// Bloqueia chamadas com voice_id fora da tabela tts_allowed_voices.
// Permissivo se a tabela ainda não existe (não quebra ambientes sem migration).

function isTableMissingError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const code = String(err.code ?? '');
  const msg = String(err.message ?? '').toLowerCase();
  // 42P01 = undefined_table no Postgres; PGRST205 = relation not found via PostgREST.
  return code === '42P01' || code === 'PGRST205' || msg.includes('does not exist') || msg.includes('relation') && msg.includes('not');
}

export async function assertVoiceAllowed(
  supabase: any,
  voiceId: string,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  if (!supabase || !voiceId) return { ok: true };
  try {
    const { data, error } = await supabase
      .from('tts_allowed_voices')
      .select('voice_id')
      .eq('voice_id', voiceId)
      .maybeSingle();
    if (error) {
      // Fail-OPEN apenas se a tabela ainda não existe (migration não aplicada).
      // Qualquer outro erro (rede, RLS, timeout) → fail-CLOSED 503.
      if (isTableMissingError(error)) return { ok: true };
      return {
        ok: false,
        response: new Response(
          JSON.stringify({
            error: 'Voice allowlist check failed (db error)',
            details: error.message ?? null,
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        ),
      };
    }
    if (data) return { ok: true };
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          error: `Voice ${voiceId} not in allowlist. Add it to tts_allowed_voices to use.`,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    };
  } catch (err: any) {
    // Exceção fora da query (rede, etc) — fail-CLOSED a menos que indique tabela ausente.
    if (isTableMissingError(err)) return { ok: true };
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          error: 'Voice allowlist check failed (exception)',
          details: String(err?.message ?? err),
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
    };
  }
}

// ─── Lesson ownership ───────────────────────────────────────────────────────
// Toda chamada TTS deve apontar para uma aula real (lesson_id) ou ser
// declarada como preview/admin tool via is_preview=true. Reduz chamadas
// órfãs que aparecem no histórico do ElevenLabs sem rastreabilidade.

const LESSON_GUARD_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

export function requireLessonOrPreview(body: {
  lesson_id?: string | null;
  is_preview?: boolean;
}): { ok: true } | { ok: false; response: Response } {
  const lessonId = body?.lesson_id;
  const isPreview = body?.is_preview === true;
  if (lessonId || isPreview) return { ok: true };
  return {
    ok: false,
    response: new Response(
      JSON.stringify({
        error: 'lesson_id is required (or set is_preview: true for admin preview/test).',
      }),
      { status: 400, headers: LESSON_GUARD_HEADERS },
    ),
  };
}

// ─── Usage logging (auditoria) ──────────────────────────────────────────────
// Registra cada chamada (cache hit ou miss) em elevenlabs_usage_log.
// Erros silenciados — log nunca bloqueia a chamada principal.

export interface TtsUsageLog {
  source_function: string;
  endpoint: 'text-to-speech' | 'with-timestamps';
  voice_id: string;
  model_id?: string;
  output_format?: string;
  char_count: number;
  cache_hit: boolean;
  request_hash: string;
  lesson_id?: string | null;
  user_id?: string | null;
  elapsed_ms?: number;
  error?: string | null;
}

export async function logTtsUsage(
  supabase: any,
  payload: TtsUsageLog,
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('elevenlabs_usage_log').insert({
      source_function: payload.source_function,
      endpoint: payload.endpoint,
      voice_id: payload.voice_id,
      model_id: payload.model_id ?? null,
      output_format: payload.output_format ?? null,
      char_count: payload.char_count,
      cache_hit: payload.cache_hit,
      request_hash: payload.request_hash,
      lesson_id: payload.lesson_id ?? null,
      user_id: payload.user_id ?? null,
      elapsed_ms: payload.elapsed_ms ?? null,
      error: payload.error ?? null,
    });
  } catch {
    // Tabela ausente, RLS, rede — nunca bloqueia a chamada TTS.
  }
}

// ─── Lesson protection ──────────────────────────────────────────────────────

/**
 * Aborta se a lição alvo já tem áudio E está aprovada / ativa / publicada.
 * Use antes de qualquer regeneração automática.
 *
 * Para forçar (admin manual), passe { force: true }.
 */
export async function assertLessonNotApproved(
  supabase: any,
  lessonId: string,
  opts: { force?: boolean; table?: 'lessons' | 'v10_lessons' } = {},
): Promise<void> {
  if (opts.force) return;
  const table = opts.table || 'lessons';
  const { data, error } = await supabase
    .from(table)
    .select('id, audio_url, word_timestamps, is_active, status')
    .eq('id', lessonId)
    .maybeSingle();

  if (error || !data) return; // não dá pra checar — não bloqueia
  const hasAudio = !!data.audio_url || !!data.word_timestamps;
  const status = String(data.status || '').toLowerCase();
  const approvedStatuses = new Set([
    'pronta', 'aprovada', 'approved', 'published', 'publicada', 'ativa', 'active',
  ]);
  const isApproved = data.is_active === true || approvedStatuses.has(status);

  if (hasAudio && isApproved) {
    throw new Error(
      `[tts-guard] Aula ${lessonId} já está aprovada/ativa e possui áudio — geração bloqueada para evitar sobrescrita. Use force=true apenas com confirmação manual.`,
    );
  }
}
