-- PR 5b3 — Correção forense + cleanup patent_level
--
-- ============================================================
-- CONTEXTO DO INCIDENTE
-- ============================================================
-- O PR #337 (migration 20260528140000) substituiu o RPC
-- link_onboarding_v2_to_user pra popular users.* com dados de gamification
-- do onboarding (hearts/sparks/xp/streak/patente). POST-CHECK confirmou
-- aplicação naquele momento.
--
-- Verificação pós-fato (PR 5b3, 2026-05-28) detectou que:
--   - schema_migrations: row 20260528140000 sumiu
--   - pg_proc body do RPC: voltou pra versão antiga (sem populate)
--   - Resultado: 5 usuários (testes internos) completaram onboarding com
--     ganhos visíveis no Reveal MAS users.* ficou com defaults
--
-- Lovable confirmou não ter tocado intencionalmente. Causa raiz não
-- identificada. Hipóteses: schema sync silencioso / reset operation.
--
-- ============================================================
-- O QUE ESTA MIGRATION FAZ (transacional, atômica)
-- ============================================================
-- 1. CREATE OR REPLACE link_onboarding_v2_to_user — versão completa,
--    agora escrevendo em patent_level (sem 'e' — canônico do app inteiro,
--    não patente_level que era órfã)
-- 2. Backfill retroativo: re-roda o RPC nos 5 (ou N) users já vinculados
--    pra popular seus dados de gamification que ficaram zerados
-- 3. DROP COLUMN patente_level (órfã, dados duplicados em patent_level)
-- 4. Asserts finais que abortam tudo se algum invariante quebrou
--
-- Tudo dentro de um único bloco transacional. Se algo falhar, ROLLBACK
-- automático — DB volta exatamente ao estado anterior.

begin;

-- ============================================================
-- 1. RECRIA RPC com lógica completa + patent_level
-- ============================================================
create or replace function public.link_onboarding_v2_to_user(
  p_session_id text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_mini record;
begin
  -- Carrega snapshot da sessão e do mini-experience
  select hook_answer, attribution, motivation, ai_level, path_choice,
         notif_permission, daily_goal_xp
    into v_session
    from public.onboarding_v2_sessions
   where session_id = p_session_id
   limit 1;

  select hearts_lost_in_desafio, mistake_review_recovered, mistake_review_sparks
    into v_mini
    from public.onboarding_v2_mini_experience
   where session_id = p_session_id
   limit 1;

  -- Linka session_id ao user_id (idempotente)
  update public.onboarding_v2_sessions
     set user_id = p_user_id,
         linked_at = now()
   where session_id = p_session_id
     and user_id is null;

  -- Popula public.users com dados do onboarding
  -- patent_level (sem 'e') = canônico do app inteiro
  update public.users
     set hook_answer = coalesce(hook_answer, v_session.hook_answer),
         attribution_source = coalesce(attribution_source, v_session.attribution),
         learning_objective = coalesce(learning_objective, v_session.motivation),
         ai_usage_level = coalesce(ai_usage_level, v_session.ai_level),
         path_choice = coalesce(path_choice, v_session.path_choice),
         notif_permission = coalesce(notif_permission, v_session.notif_permission),
         daily_goal_xp = coalesce(v_session.daily_goal_xp, daily_goal_xp),
         hearts_current = greatest(0, least(5,
           5 - coalesce(v_mini.hearts_lost_in_desafio, 0)
             + coalesce(v_mini.mistake_review_recovered, 0)
         )),
         hearts_last_lost_at = case
           when coalesce(v_mini.hearts_lost_in_desafio, 0) > coalesce(v_mini.mistake_review_recovered, 0)
             then coalesce(hearts_last_lost_at, now())
           else hearts_last_lost_at
         end,
         sparks_balance = sparks_balance + coalesce(v_mini.mistake_review_sparks, 0),
         xp_total = greatest(xp_total, 20),
         streak_days = greatest(streak_days, 1),
         patent_level = greatest(patent_level, 1)
   where id = p_user_id;
end;
$$;

grant execute on function public.link_onboarding_v2_to_user(text, uuid) to authenticated;

-- ============================================================
-- 2. BACKFILL RETROATIVO — re-roda RPC nos users já vinculados
-- ============================================================
do $$
declare
  rec record;
  affected_count int := 0;
begin
  for rec in
    select session_id, user_id
      from public.onboarding_v2_sessions
     where user_id is not null
  loop
    perform public.link_onboarding_v2_to_user(rec.session_id, rec.user_id);
    affected_count := affected_count + 1;
  end loop;
  raise notice '[PR 5b3] Backfill retroativo: % usuários processados', affected_count;
end $$;

-- ============================================================
-- 3. DROP coluna órfã patente_level
-- ============================================================
alter table public.users drop column if exists patente_level cascade;

-- ============================================================
-- 4. ASSERTS — aborta se algum invariante quebrou
-- ============================================================
do $$
declare
  body_check text;
begin
  select prosrc::text into body_check
    from pg_proc where proname = 'link_onboarding_v2_to_user' limit 1;

  if body_check is null then
    raise exception '[PR 5b3 ASSERT] RPC link_onboarding_v2_to_user não existe';
  end if;

  if body_check not like '%greatest(xp_total%' then
    raise exception '[PR 5b3 ASSERT] RPC não tem lógica de populate (greatest xp_total ausente)';
  end if;

  if body_check not like '%patent_level%' then
    raise exception '[PR 5b3 ASSERT] RPC não escreve em patent_level';
  end if;

  if body_check like '%patente_level%' then
    raise exception '[PR 5b3 ASSERT] RPC ainda referencia patente_level (deveria ser patent_level)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='users' and column_name='patente_level'
  ) then
    raise exception '[PR 5b3 ASSERT] Coluna patente_level ainda existe';
  end if;

  raise notice '[PR 5b3 ASSERT] Todos os invariantes OK';
end $$;

commit;
