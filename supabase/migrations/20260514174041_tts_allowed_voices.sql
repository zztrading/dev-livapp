-- =============================================================================
-- Allowlist de vozes do ElevenLabs.
-- =============================================================================
-- Permite que apenas vozes pré-aprovadas sejam usadas em chamadas TTS.
-- Edge functions validam voice_id contra esta tabela antes de chamar a API,
-- prevenindo gasto acidental com voz cara não revisada (ex.: voice library
-- custom com multiplicador alto).
--
-- Para adicionar nova voz: INSERT pelo admin via SQL Editor ou painel
-- equivalente. Mudança é dinâmica (não exige redeploy).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tts_allowed_voices (
  voice_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  flag TEXT,
  notes TEXT,
  enforced BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_tts_allowed_voices_enforced
  ON public.tts_allowed_voices (enforced);

-- Seed: vozes documentadas no frontend (AdminAudioPreview).
INSERT INTO public.tts_allowed_voices (voice_id, label, flag, notes)
VALUES
  ('Xb7hH8MSUJpSbSDYk0k2', 'Alice (BR Padrão)', '🇧🇷', 'Voz padrão global, multiplier ~1.67×'),
  ('EXAVITQu4vr4xnSDxMaL', 'Sarah', '🇺🇸', 'Voz library'),
  ('JBFqnCBsd6RMkjVDRZzb', 'George', '🇬🇧', 'Voz library'),
  ('TX3LPaxmHKxFdv7VOQHJ', 'Liam', '🇺🇸', 'Voz library'),
  ('nPczCjzI2devNBz1zQrb', 'Brian', '🇺🇸', 'Voz library'),
  ('FGY2WhTYpPnrIDTdsKH5', 'Laura', '🇺🇸', 'Voz library'),
  ('pFZP5JQG7iQjIQuC4Bku', 'Lily', '🇬🇧', 'Voz library'),
  ('onwK4e9ZLuTAKqWW03F9', 'Daniel', '🇬🇧', 'Voz library')
ON CONFLICT (voice_id) DO NOTHING;

-- Backfill: qualquer voice_id que já foi usado em produção entra
-- automaticamente como enforced=false (admin revisa antes de ativar).
INSERT INTO public.tts_allowed_voices (voice_id, label, notes, enforced)
SELECT DISTINCT voice_id, 'auto-seeded ' || voice_id, 'Detectado em uso anterior — revisar antes de ativar enforcement', false
FROM public.elevenlabs_usage_log
WHERE voice_id IS NOT NULL
  AND voice_id <> ''
  AND voice_id NOT IN (SELECT voice_id FROM public.tts_allowed_voices)
ON CONFLICT (voice_id) DO NOTHING;

ALTER TABLE public.tts_allowed_voices ENABLE ROW LEVEL SECURITY;

-- Admins gerenciam.
CREATE POLICY "Admins manage allowed voices"
ON public.tts_allowed_voices FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Authenticated podem ler (para validar voz antes de chamar admin tools).
CREATE POLICY "Authenticated can read allowed voices"
ON public.tts_allowed_voices FOR SELECT
TO authenticated
USING (true);
