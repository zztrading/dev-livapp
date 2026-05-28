-- PR 5b2 — BL.2: drop tabela onboarding_v2_answers (key-value legacy)
--
-- Contexto: tabela key-value criada em 2026-05-25 (PR inicial do Onboarding V2)
-- pra armazenar respostas anônimas como (session_id, question_id, answer_value).
-- M0.2a (PR #333) adicionou colunas dedicadas em onboarding_v2_sessions e
-- saveAnswer passou a fazer hybrid write em ambas as tabelas.
--
-- BL.2 fecha o loop: useOnboardingV2 refatorado pra escrever e ler SÓ
-- de onboarding_v2_sessions. Esta migration dropa a tabela legacy.
--
-- Pré-validação (rodada via SQL editor antes desta migration):
--   - Zero triggers/RPCs/views referenciam a tabela
--   - Zero FKs apontam pra ela
--   - Zero edge functions tocam
--   - useOnboardingV2.ts refatorado: zero leitura/escrita
--   - 0 rows em prod (nunca foi populada efetivamente)

drop table if exists public.onboarding_v2_answers cascade;
