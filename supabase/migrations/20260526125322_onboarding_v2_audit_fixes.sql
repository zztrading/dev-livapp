-- Onboarding V2 — fixes da auditoria (Sprint 4.5)
--
-- 1. Persistência de step no flow externo (last_step em sessions)
-- 2. Persistência de combo bonus acumulado (mini_experience)
-- 3. FK constraint em events.session_id (anti-DoS)
-- 4. Lock RLS: anon não pode alterar rows depois de linkar a user_id
-- 5. Drop policies legadas de Storage com role 'dev' (enum nunca teve 'dev')

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Persistência de step do flow externo (refresh recupera onde parou)
-- ─────────────────────────────────────────────────────────────────────────
alter table public.onboarding_v2_sessions
  add column if not exists last_step text;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Persistência do combo bonus acumulado (mini_experience)
-- ─────────────────────────────────────────────────────────────────────────
alter table public.onboarding_v2_mini_experience
  add column if not exists combo_bonus_accumulated integer not null default 0
  check (combo_bonus_accumulated >= 0 and combo_bonus_accumulated <= 30);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. FK constraint em events.session_id (anti-DoS de baixo nível)
-- ─────────────────────────────────────────────────────────────────────────
-- Remove eventos órfãos primeiro pra não bloquear a constraint
delete from public.onboarding_v2_events
where session_id not in (select session_id from public.onboarding_v2_sessions);

alter table public.onboarding_v2_events
  drop constraint if exists onboarding_v2_events_session_id_fkey,
  add constraint onboarding_v2_events_session_id_fkey
    foreign key (session_id)
    references public.onboarding_v2_sessions(session_id)
    on delete cascade;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Lock RLS — anon não pode mais alterar rows depois de linkar a user_id
-- ─────────────────────────────────────────────────────────────────────────
-- Sessions: anon update só enquanto user_id is null (não vinculado a conta)
drop policy if exists "anyone can update own session" on public.onboarding_v2_sessions;
create policy "anon updates only unlinked sessions"
  on public.onboarding_v2_sessions for update
  to anon
  using (user_id is null)
  with check (user_id is null);

create policy "authenticated can update own session"
  on public.onboarding_v2_sessions for update
  to authenticated
  using (user_id = auth.uid() or user_id is null)
  with check (user_id = auth.uid() or user_id is null);

-- Answers: idem — não permitir alterar após linkar
drop policy if exists "anyone can update onboarding answers" on public.onboarding_v2_answers;
create policy "anon updates only unlinked answers"
  on public.onboarding_v2_answers for update
  to anon
  using (
    session_id in (
      select session_id from public.onboarding_v2_sessions where user_id is null
    )
  )
  with check (
    session_id in (
      select session_id from public.onboarding_v2_sessions where user_id is null
    )
  );

create policy "authenticated can update own answers"
  on public.onboarding_v2_answers for update
  to authenticated
  using (
    session_id in (
      select session_id from public.onboarding_v2_sessions
      where user_id = auth.uid() or user_id is null
    )
  )
  with check (
    session_id in (
      select session_id from public.onboarding_v2_sessions
      where user_id = auth.uid() or user_id is null
    )
  );

-- Mini-experience: mesmo padrão
drop policy if exists "anyone can update own mini experience" on public.onboarding_v2_mini_experience;
create policy "anon updates only unlinked mini-experience"
  on public.onboarding_v2_mini_experience for update
  to anon
  using (
    session_id in (
      select session_id from public.onboarding_v2_sessions where user_id is null
    )
  )
  with check (
    session_id in (
      select session_id from public.onboarding_v2_sessions where user_id is null
    )
  );

create policy "authenticated can update own mini-experience"
  on public.onboarding_v2_mini_experience for update
  to authenticated
  using (
    session_id in (
      select session_id from public.onboarding_v2_sessions
      where user_id = auth.uid() or user_id is null
    )
  )
  with check (
    session_id in (
      select session_id from public.onboarding_v2_sessions
      where user_id = auth.uid() or user_id is null
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Drop policies legadas de Storage com role 'dev'
--    (a enum app_role nunca teve 'dev'; migration 20260526121924
--    já corrigiu pra has_role, mas as antigas continuaram no schema)
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "uau-images: admin/dev can upload" on storage.objects;
drop policy if exists "uau-images: admin/dev can update" on storage.objects;
drop policy if exists "uau-images: admin/dev can delete" on storage.objects;
