-- Onboarding V2 — pre-signup flow (estilo Duolingo)
create table if not exists public.onboarding_v2_sessions (
  session_id text primary key,
  variant text not null default 'v2'
    check (variant in ('v1', 'v2')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer text,
  user_agent text,
  daily_goal_xp integer
    check (daily_goal_xp in (10, 20, 30, 50)),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  user_id uuid references auth.users(id) on delete set null,
  linked_at timestamptz
);

create index if not exists onboarding_v2_sessions_user_id_idx
  on public.onboarding_v2_sessions(user_id) where user_id is not null;

create index if not exists onboarding_v2_sessions_variant_idx
  on public.onboarding_v2_sessions(variant, started_at desc);

create table if not exists public.onboarding_v2_answers (
  id bigint generated always as identity primary key,
  session_id text not null
    references public.onboarding_v2_sessions(session_id) on delete cascade,
  question_id text not null
    check (question_id in (
      'attribution','motivation','ai_level','daily_goal','prompt_knowledge','notification_opt'
    )),
  answer_value text not null,
  answered_at timestamptz not null default now(),
  unique(session_id, question_id)
);

create index if not exists onboarding_v2_answers_session_idx
  on public.onboarding_v2_answers(session_id);

create table if not exists public.onboarding_v2_events (
  id bigint generated always as identity primary key,
  session_id text not null,
  variant text,
  event_name text not null,
  event_data jsonb,
  user_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists onboarding_v2_events_session_idx
  on public.onboarding_v2_events(session_id, created_at);

create index if not exists onboarding_v2_events_name_idx
  on public.onboarding_v2_events(event_name, created_at desc);

GRANT SELECT, INSERT, UPDATE ON public.onboarding_v2_sessions TO anon, authenticated;
GRANT ALL ON public.onboarding_v2_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.onboarding_v2_answers TO anon, authenticated;
GRANT ALL ON public.onboarding_v2_answers TO service_role;
GRANT INSERT ON public.onboarding_v2_events TO anon, authenticated;
GRANT ALL ON public.onboarding_v2_events TO service_role;

alter table public.onboarding_v2_sessions enable row level security;
alter table public.onboarding_v2_answers  enable row level security;
alter table public.onboarding_v2_events   enable row level security;

create policy "anyone can create onboarding session"
  on public.onboarding_v2_sessions for insert
  to anon, authenticated
  with check (true);

create policy "anyone can update own session"
  on public.onboarding_v2_sessions for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "user can read own session"
  on public.onboarding_v2_sessions for select
  to authenticated
  using (user_id = auth.uid());

create policy "anyone can upsert onboarding answers"
  on public.onboarding_v2_answers for insert
  to anon, authenticated
  with check (true);

create policy "anyone can update onboarding answers"
  on public.onboarding_v2_answers for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "user can read own answers"
  on public.onboarding_v2_answers for select
  to authenticated
  using (
    session_id in (
      select session_id from public.onboarding_v2_sessions where user_id = auth.uid()
    )
  );

create policy "anyone can log events"
  on public.onboarding_v2_events for insert
  to anon, authenticated
  with check (true);

create or replace function public.link_onboarding_v2_to_user(
  p_session_id text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.onboarding_v2_sessions
     set user_id = p_user_id,
         linked_at = now()
   where session_id = p_session_id
     and user_id is null;
end;
$$;

grant execute on function public.link_onboarding_v2_to_user(text, uuid) to authenticated;