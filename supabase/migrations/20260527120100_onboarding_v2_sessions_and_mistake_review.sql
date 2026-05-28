-- M0.2a — Onboarding V2 (FASE 0): partes ADITIVAS do refactor hybrid.
--
-- Cobre 3 áreas, todas aditivas (zero risco de quebrar runtime):
--   A. onboarding_v2_sessions: colunas dedicadas pro wizard + deferred token
--   B. onboarding_v2_mini_experience: colunas do Mistake Review
--   C. Indexes auxiliares
--
-- O que NÃO está nesta migration (vai pra M0.2b no PR 3, junto com refactor do front):
--   - Drop UAU2 SWOT (uau2_moment/challenge/goal) — colunas ainda lidas pelo front
--   - Add UAU2 Chips V5 (uau2_verb/who/tone/intent) — espera refactor do useMiniExperience
--   - Cap dominio_score em 100 (era 130) — espera refactor do front
--   - Reduzir dominio_level pra 4 opções (remove 'perfeito') — espera refactor
--
-- Pré-validação rodada antes desta migration:
--   P3: onboarding_v2_answers tem 0 rows → backfill key-value→colunas é noop, removido

-- ============================================================
-- A. SESSIONS: colunas dedicadas pro wizard de coleta + deferred token
-- ============================================================
alter table public.onboarding_v2_sessions
  add column if not exists hook_answer text
    check (hook_answer is null or hook_answer in ('torcer','garantir')),
  add column if not exists attribution text,
  add column if not exists motivation text,
  add column if not exists ai_level text
    check (ai_level is null or ai_level in ('nunca','testei','as_vezes','todo_dia')),
  add column if not exists path_choice text
    check (path_choice is null or path_choice in ('zero','placement')),
  add column if not exists notif_permission text
    check (notif_permission is null or notif_permission in ('granted','denied','default')),
  add column if not exists deferred_session_token uuid unique,
  add column if not exists deferred_expires_at timestamptz;

comment on column public.onboarding_v2_sessions.hook_answer is
  'Resposta da Tela 4 (Hook). Espelha users.hook_answer pós-signup.';
comment on column public.onboarding_v2_sessions.deferred_session_token is
  'UUID opaco salvo em cookie HttpOnly (TTL 7d) para retomar onboarding pós-DEPOIS na Tela 13.';
comment on column public.onboarding_v2_sessions.deferred_expires_at is
  'Expiração do deferred_session_token. Após isto, token é inválido.';

-- ============================================================
-- B. MINI EXPERIENCE: colunas do Mistake Review
-- ============================================================
alter table public.onboarding_v2_mini_experience
  add column if not exists hearts_lost_in_desafio integer not null default 0
    check (hearts_lost_in_desafio between 0 and 4),
  add column if not exists mistake_review_attempted boolean not null default false,
  add column if not exists mistake_review_recovered integer not null default 0
    check (mistake_review_recovered between 0 and 4),
  add column if not exists mistake_review_sparks integer not null default 0
    check (mistake_review_sparks >= 0);

comment on column public.onboarding_v2_mini_experience.hearts_lost_in_desafio is
  'Quantas vidas o usuário perdeu nas sub-telas 2/3/4/7 do Desafio (0-4). Define quantas tentativas o Mistake Review oferece.';
comment on column public.onboarding_v2_mini_experience.mistake_review_attempted is
  'true se o Mistake Review foi executado (Caso A: errou 1+). false se foi pulado pra Reward direto (Caso B: acertou tudo).';
comment on column public.onboarding_v2_mini_experience.mistake_review_recovered is
  'Quantas vidas o usuário recuperou no Mistake Review (0 a hearts_lost_in_desafio).';
comment on column public.onboarding_v2_mini_experience.mistake_review_sparks is
  'Sparks creditadas no Mistake Review. Caso A: 5. Caso B: 10 (bônus de mestre).';

-- ============================================================
-- C. INDEXES
-- ============================================================
create index if not exists onboarding_v2_sessions_deferred_token_idx
  on public.onboarding_v2_sessions(deferred_session_token)
  where deferred_session_token is not null;
