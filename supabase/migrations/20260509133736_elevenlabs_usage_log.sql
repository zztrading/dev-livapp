-- Tabela de auditoria de uso da ElevenLabs.
-- Cada chamada (cache hit ou miss) registra uma linha. Permite detectar
-- duplicação, identificar funções mortas, e correlacionar custo a aulas.

CREATE TABLE public.elevenlabs_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_function TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  model_id TEXT,
  output_format TEXT,
  char_count INTEGER NOT NULL DEFAULT 0,
  cache_hit BOOLEAN NOT NULL DEFAULT false,
  request_hash TEXT NOT NULL,
  lesson_id UUID,
  user_id UUID,
  elapsed_ms INTEGER,
  error TEXT
);

CREATE INDEX idx_elevenlabs_usage_log_request_hash
  ON public.elevenlabs_usage_log (request_hash);

CREATE INDEX idx_elevenlabs_usage_log_source_created
  ON public.elevenlabs_usage_log (source_function, created_at DESC);

CREATE INDEX idx_elevenlabs_usage_log_created
  ON public.elevenlabs_usage_log (created_at DESC);

CREATE INDEX idx_elevenlabs_usage_log_lesson
  ON public.elevenlabs_usage_log (lesson_id)
  WHERE lesson_id IS NOT NULL;

ALTER TABLE public.elevenlabs_usage_log ENABLE ROW LEVEL SECURITY;

-- Admin lê tudo.
CREATE POLICY "Admins can read usage log"
ON public.elevenlabs_usage_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Inserts vêm de edge functions via service_role (bypassa RLS).
-- Nenhuma policy de INSERT/UPDATE/DELETE para usuários autenticados.
