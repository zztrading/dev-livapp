-- Onboarding V2 — pre-signup flow (estilo Duolingo)
-- Sessões anônimas, respostas idempotentes, eventos analíticos.
-- A sessão é vinculada a um user_id ao final do fluxo (quando o usuário cria conta).

-- =========================================================================
-- 1. SESSIONS — uma row por visitante anônimo iniciando o quiz
-- =========================================================================
create table if not exists public.onboarding_v2_sessions (
  session_id text primary key,                       -- UUID gerado no cliente
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
  completed_at timestamptz,                          -- quando chega na tela de cadastro
  user_id uuid references auth.users(id) on delete set null,  -- linkado após signup
  linked_at timestamptz
);

create index if not exists onboarding_v2_sessions_user_id_idx
  on public.onboarding_v2_sessions(user_id) where user_id is not null;

create index if not exists onboarding_v2_sessions_variant_idx
  on public.onboarding_v2_sessions(variant, started_at desc);

-- =========================================================================
-- 2. ANSWERS — respostas do quiz (uma por question_id, idempotente)
-- =========================================================================
create table if not exists public.onboarding_v2_answers (
  id bigint generated always as identity primary key,
  session_id text not null
    references public.onboarding_v2_sessions(session_id) on delete cascade,
  question_id text not null
    check (question_id in (
      'attribution',       -- como conheceu (Tela 3)
      'motivation',        -- objetivo principal (Tela 4)
      'ai_level',          -- nível de uso de IA (Tela 5)
      'daily_goal',        -- meta diária em XP (Tela 7)
      'prompt_knowledge',  -- sabe o que é prompt? (Tela 9)
      'notification_opt'   -- aceitou notificação (Tela 8) - 'granted'|'denied'|'dismissed'
    )),
  answer_value text not null,
  answered_at timestamptz not null default now(),
  -- Idempotência: upsert por (session_id, question_id) corrige bug do v1
  unique(session_id, question_id)
);

create index if not exists onboarding_v2_answers_session_idx
  on public.onboarding_v2_answers(session_id);

-- =========================================================================
-- 3. EVENTS — analytics caseiro, em paralelo a qualquer ferramenta externa
-- =========================================================================
create table if not exists public.onboarding_v2_events (
  id bigint generated always as identity primary key,
  session_id text not null,
  variant text,
  event_name text not null,           -- ex: 'tela_2_view', 'cta_clicked', 'placement_completed'
  event_data jsonb,
  user_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists onboarding_v2_events_session_idx
  on public.onboarding_v2_events(session_id, created_at);

create index if not exists onboarding_v2_events_name_idx
  on public.onboarding_v2_events(event_name, created_at desc);

-- =========================================================================
-- 4. RLS — fluxo anônimo: inserts liberados, leitura restrita
-- =========================================================================
alter table public.onboarding_v2_sessions enable row level security;
alter table public.onboarding_v2_answers  enable row level security;
alter table public.onboarding_v2_events   enable row level security;

-- Sessions: anon pode criar + atualizar a própria via session_id no body
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

-- Answers: anon pode upsert (insert + update) por session_id
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

-- Events: anon pode inserir, ninguém lê (analytics agregada via service role)
create policy "anyone can log events"
  on public.onboarding_v2_events for insert
  to anon, authenticated
  with check (true);

-- =========================================================================
-- 5. RPC — vincular sessão ao user após signup
-- =========================================================================
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
