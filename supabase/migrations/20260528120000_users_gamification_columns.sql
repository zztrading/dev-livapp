-- PR 2 (FASE 1) — colunas de gamificação faltantes em public.users
--
-- Cobre 3 colunas que o spec-onboarding-completo-v2.md exige pra Tela 11 (Reveal):
--   - sparks_balance: moeda virtual ganha no Mistake Review e gasta na Loja
--   - xp_total: XP acumulado (Reveal soma +20 iniciais)
--   - patente_level: nível de patente (Novato Nv 1 = 1)
--
-- Aditiva, idempotente. streak_days NÃO incluso (já existe — validado SQL).
--
-- Nota sobre patente_level: o spec usa nome com 'e' (patente). A coluna legacy
-- patent_level (sem 'e') permanece intacta nesta migration — rename fica pra PR
-- de cleanup futuro após auditar consumidores da coluna antiga.

alter table public.users
  add column if not exists sparks_balance integer not null default 0
    check (sparks_balance >= 0),
  add column if not exists xp_total integer not null default 0
    check (xp_total >= 0),
  add column if not exists patente_level integer not null default 1
    check (patente_level >= 1);

comment on column public.users.sparks_balance is
  'Saldo de Sparks (moeda virtual). Ganha +5 ou +10 no Mistake Review da Tela 10. Spec linhas 988, 1013-1020.';
comment on column public.users.xp_total is
  'XP total acumulado. Reveal (Tela 11) soma +20 iniciais. Spec linha 1008.';
comment on column public.users.patente_level is
  'Nível de patente do usuário. Novato Nv 1 = 1. Spec linha 1010, 1015. Nome com ''e'' (português correto).';
