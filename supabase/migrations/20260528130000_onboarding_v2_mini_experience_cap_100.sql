-- PR 3 (FASE 2) — Migration M0.2b: cap dominio_score em 100 + drop level 'perfeito'
--
-- Spec onboarding v2 (linhas 39-43, 1196): cap real do Domínio IA é 100,
-- mesmo com combo bonus. Implementação antiga tinha cap 130 (combo absorvido
-- no display mas estado interno até 130).
--
-- Drop do level 'perfeito' (5 levels → 4 levels) — spec usa só:
--   iniciante (30-49) / curioso (50-69) / intermediario (70-89) / avancado (90-100)
--
-- Cobre 4 áreas:
--   A. UPDATE dados existentes pra caber no novo cap
--   B. Trocar constraint de cap (130 → 100)
--   C. Trocar constraint de level (5 valores → 4 valores)
--   D. (Chips V5 cols NÃO entram — decisão de produto: não persistir,
--       Chips V5 só roda em memória durante a sessão)

-- ============================================================
-- A. NORMALIZAR DADOS EXISTENTES (necessário antes do CHECK novo)
-- ============================================================
update public.onboarding_v2_mini_experience
   set dominio_score = 100
 where dominio_score is not null
   and dominio_score > 100;

update public.onboarding_v2_mini_experience
   set dominio_level = 'avancado'
 where dominio_level = 'perfeito';

-- ============================================================
-- B. CAP dominio_score em 100 (era 130)
-- ============================================================
alter table public.onboarding_v2_mini_experience
  drop constraint if exists onboarding_v2_mini_experience_dominio_score_check;

alter table public.onboarding_v2_mini_experience
  add constraint onboarding_v2_mini_experience_dominio_score_check
    check (dominio_score is null or (dominio_score >= 0 and dominio_score <= 100));

-- ============================================================
-- C. dominio_level drop 'perfeito' (5 levels → 4 levels)
-- ============================================================
alter table public.onboarding_v2_mini_experience
  drop constraint if exists onboarding_v2_mini_experience_dominio_level_check;

alter table public.onboarding_v2_mini_experience
  add constraint onboarding_v2_mini_experience_dominio_level_check
    check (dominio_level is null or dominio_level in (
      'iniciante',
      'curioso',
      'intermediario',
      'avancado'
    ));

comment on column public.onboarding_v2_mini_experience.dominio_score is
  'Score final do Desafio (cap real 100, spec v2). Combo bonus é absorvido pelo cap.';
comment on column public.onboarding_v2_mini_experience.dominio_level is
  'Faixa de Domínio IA. iniciante=30-49, curioso=50-69, intermediario=70-89, avancado=90-100. Spec v2 removeu ''perfeito''.';
