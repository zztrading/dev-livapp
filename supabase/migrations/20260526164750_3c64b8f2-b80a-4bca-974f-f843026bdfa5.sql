create table if not exists public.onboarding_v2_mini_experience (
  session_id text primary key
    references public.onboarding_v2_sessions(session_id) on delete cascade,
  filter_interest text check (filter_interest in ('visual', 'writing')),
  quiz_t2_answer text,
  quiz_t2_correct boolean,
  quiz_t3_answer text,
  quiz_t3_correct boolean,
  quiz_t4_answer text,
  quiz_t4_correct boolean,
  quiz_t7_answer text,
  quiz_t7_correct boolean,
  uau1_style text,
  uau1_theme text,
  uau1_writing text,
  uau2_moment text,
  uau2_challenge text,
  uau2_goal text,
  uau2_prompt_built text,
  dominio_score integer
    check (dominio_score is null or (dominio_score >= 0 and dominio_score <= 130)),
  dominio_level text
    check (dominio_level is null or dominio_level in (
      'iniciante','curioso','intermediario','avancado','perfeito'
    )),
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

GRANT SELECT, INSERT, UPDATE ON public.onboarding_v2_mini_experience TO anon, authenticated;
GRANT ALL ON public.onboarding_v2_mini_experience TO service_role;

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