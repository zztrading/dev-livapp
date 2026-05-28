-- M0.1 — Onboarding V2 (FASE 0): colunas em public.users
--
-- Adiciona campos coletados pelo wizard de coleta + estado de gamificação base.
-- Aditiva, idempotente. streak_days NÃO incluso (já existe — validado via P2).
--
-- Pré-validação rodada antes desta migration:
--   P1: notifications_enabled BOOL existe → backfill abaixo aplica
--   P2: streak_days já existe → omitido
--
-- BL.1 (drop notifications_enabled) fica pra PR de cleanup pós-soak,
-- após Profile.tsx ser refatorado pra ler notif_permission.

alter table public.users
  add column if not exists hook_answer text
    check (hook_answer is null or hook_answer in ('torcer','garantir')),
  add column if not exists attribution_source text,
  add column if not exists learning_objective text,
  add column if not exists ai_usage_level text
    check (ai_usage_level is null or ai_usage_level in ('nunca','testei','as_vezes','todo_dia')),
  add column if not exists daily_goal_xp integer default 20
    check (daily_goal_xp in (10,20,30,50)),
  add column if not exists path_choice text
    check (path_choice is null or path_choice in ('zero','placement')),
  add column if not exists notif_permission text
    check (notif_permission is null or notif_permission in ('granted','denied','default')),
  add column if not exists hearts_current integer default 5
    check (hearts_current between 0 and 5),
  add column if not exists hearts_last_lost_at timestamptz;

-- Backfill: notifications_enabled BOOL → notif_permission TEXT.
-- Coluna legacy notifications_enabled permanece (Profile.tsx ainda lê dela).
update public.users
   set notif_permission = case
     when notifications_enabled is true then 'granted'
     when notifications_enabled is false then 'denied'
     else 'default'
   end
 where notif_permission is null;

comment on column public.users.notif_permission is
  'Estado do permission do navegador para push notifications. Valores: granted/denied/default. Substitui notifications_enabled BOOL (drop em PR posterior).';
comment on column public.users.hook_answer is
  'Resposta da Tela 4 (Hook). torcer = vai torcer pra IA; garantir = vai garantir lugar.';
comment on column public.users.path_choice is
  'Tela 9: começar do zero (zero) ou encontrar o nível (placement).';
comment on column public.users.daily_goal_xp is
  'Meta diária de XP escolhida no onboarding. 10/20/30/50.';
comment on column public.users.hearts_current is
  'Vidas atuais do usuário (0-5). Recupera no Mistake Review e via regen passivo.';
comment on column public.users.hearts_last_lost_at is
  'Timestamp da última vida perdida — usado pra calcular regen passivo.';
