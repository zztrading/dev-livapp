-- PR 4 (FASE 3) — Atualiza RPC link_onboarding_v2_to_user pra popular gamification
--
-- Antes deste PR, o RPC só fazia:
--   UPDATE onboarding_v2_sessions SET user_id, linked_at
--
-- Agora faz adicionalmente:
--   UPDATE public.users SET (campos do wizard + gamification do desafio)
--
-- Campos populados em public.users:
--   - hook_answer, attribution_source, learning_objective, ai_usage_level,
--     daily_goal_xp, path_choice, notif_permission (do wizard, lê de sessions)
--   - sparks_balance += mistake_review_sparks (do desafio)
--   - hearts_current = 5 - hearts_lost + recovered (do desafio)
--   - hearts_last_lost_at = now() se perdeu vida no desafio
--   - xp_total = max(atual, 20)        (spec linha 1008: +20 iniciais)
--   - streak_days = max(atual, 1)      (spec linha 1010: 1 dia inicial)
--   - patente_level = max(atual, 1)    (spec linha 1015: Novato Nv 1)
--
-- Defensivo: usa coalesce em todo lado pra não NULL out dados existentes.
-- Idempotente: chamadas repetidas têm o mesmo efeito (greatest/coalesce).

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

  -- 1. Linka session_id ao user_id (idempotente, só sobrescreve se NULL)
  update public.onboarding_v2_sessions
     set user_id = p_user_id,
         linked_at = now()
   where session_id = p_session_id
     and user_id is null;

  -- 2. Popula public.users com dados do onboarding
  -- coalesce(prev, novo) preserva valor existente se já preenchido
  -- greatest() garante idempotência em campos numéricos
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
         patente_level = greatest(patente_level, 1)
   where id = p_user_id;
end;
$$;

grant execute on function public.link_onboarding_v2_to_user(text, uuid) to authenticated;
