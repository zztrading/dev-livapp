-- PR 5b1 — BL.1: drop coluna legacy public.users.notifications_enabled
--
-- Contexto: a coluna BOOL notifications_enabled (criada em 2025-11-25) foi
-- substituída pela coluna TEXT notif_permission no PR #333 (M0.1, FASE 0 do
-- Onboarding V2). Backfill foi feito na época. Profile.tsx mantinha sync
-- duplo (escrita em ambas) como compat layer "até BL.1".
--
-- Pré-validação (rodada via SQL editor antes desta migration):
--   - Zero triggers/RPCs/views referenciam notifications_enabled
--   - Zero indexes usam a coluna
--   - Zero constraints CHECK/FK mencionam
--   - Profile.tsx refatorado: zero leitura/escrita de notifications_enabled
--   - 5 rows / 5 consistentes (notifications_enabled BOOL ↔ notif_permission TEXT)
--
-- Esta migration:
--   1. Drop notifications_enabled (CASCADE pra cobrir qualquer dependência
--      remanescente — não deve existir, mas é defensive)

alter table public.users
  drop column if exists notifications_enabled cascade;
