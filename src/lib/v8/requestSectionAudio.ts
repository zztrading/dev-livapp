import { AUDIO_RETRY_DELAYS_MS, type AudioResult } from "./types";

export interface RequestSectionAudioParams {
  lessonId: string;
  accessToken: string;
  type: string;
  index: number;
  text: string;
  previousText?: string;
  nextText?: string;
  onRetry?: (attempt: number, delayMs: number, reason: string) => void;
}

/**
 * Chama v8-generate-section-audio com retry exponencial.
 *
 * Usa fetch direto (não supabase.functions.invoke) para discriminar
 * status HTTP 5xx (retry) vs outros (throw). invoke não expõe status code.
 *
 * Retorna AudioResult | null:
 * - null se text vazio ou response.skipped (texto não falável)
 * - AudioResult se gerou com sucesso
 *
 * Throws em qualquer outro erro após retries esgotados.
 *
 * Extraído de src/pages/AdminV8Create.tsx (era useCallback inline).
 */
export async function requestSectionAudio({
  lessonId,
  accessToken,
  type,
  index,
  text,
  previousText,
  nextText,
  onRetry,
}: RequestSectionAudioParams): Promise<AudioResult | null> {
  if (!text?.trim()) return null;

  for (let attempt = 0; attempt <= AUDIO_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/v8-generate-section-audio`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ lessonId, type, index, text, previousText, nextText }),
        }
      );

      if (!res.ok) {
        const errBody = await res.text();
        const reason = `${type} ${index}: ${res.status} - ${errBody.slice(0, 160)}`;

        if (res.status >= 500 && attempt < AUDIO_RETRY_DELAYS_MS.length) {
          const delayMs = AUDIO_RETRY_DELAYS_MS[attempt];
          onRetry?.(attempt + 1, delayMs, reason);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        throw new Error(reason);
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const body = await res.text();
        throw new Error(`${type} ${index}: unexpected content-type "${contentType}" - ${body.slice(0, 160)}`);
      }

      const data = await res.json();
      if (data.skipped) return null;
      return data as AudioResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isRetryableNetworkError =
        error instanceof TypeError ||
        /failed to fetch|networkerror|network request failed/i.test(message);

      if (isRetryableNetworkError && attempt < AUDIO_RETRY_DELAYS_MS.length) {
        const delayMs = AUDIO_RETRY_DELAYS_MS[attempt];
        onRetry?.(attempt + 1, delayMs, message);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      throw error instanceof Error ? error : new Error(message);
    }
  }

  throw new Error(`${type} ${index}: retries exhausted`);
}
