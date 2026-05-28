-- PR 5a — Hearts regen 3h via pg_cron
--
-- Spec onboarding v2 (linhas 285-289): aluno perde Vida em quiz errado.
-- Vidas regeneram automaticamente: 1 Vida a cada 3 horas (10800 segundos).
--
-- Implementação: pg_cron job dispara public.regen_hearts_3h() a cada hora.
-- A função calcula quantas Vidas restaurar baseado em hearts_last_lost_at e
-- aplica UPDATE só nas rows que precisam (hearts_current < 5 AND last_lost IS NOT NULL).
--
-- Cron expressao: '0 * * * *' = todo minuto 0 de toda hora.
-- Pior caso pra aluno: espera 3h + até 59min antes do próximo cron tick.
-- Best case: regen acontece exatamente 3h depois (alinhamento de relógio).

-- ============================================================
-- A. FUNCTION que faz o regen
-- ============================================================
create or replace function public.regen_hearts_3h()
returns void
language sql
security definer
set search_path = public
as $$
  -- Calcula quantas Vidas restaurar = floor(elapsed_seconds / 10800)
  -- Avança hearts_last_lost_at em (recovered * 3h). Se ficou cheio (5/5), zera.
  update public.users
     set hearts_current = least(5,
           hearts_current + floor(extract(epoch from (now() - hearts_last_lost_at)) / 10800)::int),
         hearts_last_lost_at = case
           when hearts_current
              + floor(extract(epoch from (now() - hearts_last_lost_at)) / 10800)::int >= 5
             then null
           else hearts_last_lost_at
              + (interval '3 hours' * floor(extract(epoch from (now() - hearts_last_lost_at)) / 10800)::int)
         end
   where hearts_current < 5
     and hearts_last_lost_at is not null
     and extract(epoch from (now() - hearts_last_lost_at)) >= 10800;
$$;

comment on function public.regen_hearts_3h() is
  'Regenera 1 Vida a cada 3 horas baseado em hearts_last_lost_at. Chamada periodicamente via pg_cron.';

grant execute on function public.regen_hearts_3h() to service_role;

-- ============================================================
-- B. CRON JOB que dispara a function a cada hora
-- ============================================================
-- Remove job antigo se existir (idempotente em re-runs da migration)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'regen-hearts-3h') then
    perform cron.unschedule('regen-hearts-3h');
  end if;
end $$;

select cron.schedule(
  'regen-hearts-3h',
  '0 * * * *',
  $$select public.regen_hearts_3h();$$
);
