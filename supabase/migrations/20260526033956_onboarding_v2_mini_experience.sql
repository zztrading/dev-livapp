-- Onboarding V2 — Mini-experiência IA (Tela 10 do quiz)
--
-- Tabela WIDE (1 row por session) com:
--   - filter_interest (Tela 1)
--   - 4 quiz responses (Telas 2, 3, 4, 7) com correct flag
--   - UAU 1 (depende do filtro: visual ou escrita)
--   - UAU 2 (SWOT do meu momento — universal)
--   - score final + level (mostrado na tela Reveal)
--
-- Justificativa do schema wide vs adicionar em onboarding_v2_answers:
-- onboarding_v2_answers é LONG (question_id+answer_value por row) — não
-- combina com uma estrutura conhecida e fechada. Wide é mais simples,
-- type-safe, e permite query analítica direta (média de score por variant,
-- distribuição de filter_interest, etc).

create table if not exists public.onboarding_v2_mini_experience (
  session_id text primary key
    references public.onboarding_v2_sessions(session_id) on delete cascade,

  -- Tela 1: Filtro de Interesse
  filter_interest text check (filter_interest in ('visual', 'writing')),

  -- Telas 2, 3, 4, 7: Quizzes
  quiz_t2_answer text,
  quiz_t2_correct boolean,
  quiz_t3_answer text,
  quiz_t3_correct boolean,
  quiz_t4_answer text,
  quiz_t4_correct boolean,
  quiz_t7_answer text,
  quiz_t7_correct boolean,

  -- Tela 5 (UAU 1) — depende do filtro
  uau1_style text,     -- só se Visual
  uau1_theme text,     -- só se Visual
  uau1_writing text,   -- só se Escrita (ex: 'email_rewrite')

  -- Tela 6 (UAU 2) — SWOT universal
  uau2_moment text,
  uau2_challenge text,
  uau2_goal text,
  uau2_prompt_built text,

  -- Pontuação final (0-130 — 100 base + até 30 de combos)
  dominio_score integer
    check (dominio_score is null or (dominio_score >= 0 and dominio_score <= 130)),
  dominio_level text
    check (dominio_level is null or dominio_level in (
      'iniciante',     -- 40-59
      'curioso',       -- 60-79
      'intermediario', -- 80-94
      'avancado',      -- 95-99
      'perfeito'       -- 100+
    )),

  -- Tracking
  current_substep text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists onboarding_v2_mini_experience_completed_idx
  on public.onboarding_v2_mini_experience(completed_at desc)
  where completed_at is not null;

create index if not exists onboarding_v2_mini_experience_score_idx
  on public.onboarding_v2_mini_experience(dominio_score desc)
  where dominio_score is not null;

-- RLS: anon pode upsert (fluxo pré-signup, mesma estratégia do answers)
alter table public.onboarding_v2_mini_experience enable row level security;

create policy "anyone can create mini experience row"
  on public.onboarding_v2_mini_experience for insert
  to anon, authenticated
  with check (true);

create policy "anyone can update own mini experience"
  on public.onboarding_v2_mini_experience for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "user can read own mini experience"
  on public.onboarding_v2_mini_experience for select
  to authenticated
  using (
    session_id in (
      select session_id from public.onboarding_v2_sessions where user_id = auth.uid()
    )
  );
