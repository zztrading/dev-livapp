# Implementação Técnica — Plano AILIV v2 (Anexo do Spec Consolidada)

> Anexo técnico do `plano-ailiv-v2-spec-consolidada.md`.
> Detalha implementação completa: schemas SQL com RLS + componentes React + edge functions + integração + estimativa + dependências + tratamento de edge cases.
>
> **Versão:** 2.0 (revisada — maio/2026 — auditoria técnica aplicada)
> **Status:** TUDO pronto pra Claude Code executar.

---

## Sumário de horas

| Gap / Fase | Horas |
|-----|-------|
| Fase 0 — Reparos cirúrgicos (3 bugs) | 4h |
| Fase 1 — Consolidação base | 6h |
| **G1** Daily Goal | 7h |
| **G3** Path Visual (com G4 Crowns Bronze+Ouro) | 11h |
| Fase 2 — Loja enxuta (4 itens) | 10h |
| Fase 3 — Hearts System + **G6** practice to earn | 14h |
| **G8** Onboarding gamificado | 9h |
| **G5** Combo dentro da lição | 5h |
| **G7** Notificações da LIV | 11h |
| **G10** XP Boost com timer | 7h |
| **G9** Friend Quest básico | 8h |
| Fase 5 — Insights Playground | 14h |
| Fase 6 — Achievements 2.0 | 10h |
| **Total bruto** | **~116h** |
| Com buffer 20% | **~140h** |

Prazo: 3-4 semanas full-time.

---

## Padrões técnicos (decisões da auditoria)

### Aud-1 — Padrão técnico

- **ID type:** UUID em TODAS as tabelas (compatível com `auth.users.id` do Supabase)
- **RLS:** habilitado em TODAS as tabelas com policy padrão `auth.uid() = user_id` pra dados de aluno
- **Tabelas de definição** (templates, achievements, shop_items): RLS habilitado mas com SELECT público
- **Naming convention:** Claude Code segue o padrão atual do banco (snake_case inglês com algumas tabelas em PT como `trilhas`)
- **Migrations:** pasta `supabase/migrations/` com timestamp no nome (ex: `20260520_g1_daily_goal.sql`)
- **Timestamps:** sempre `TIMESTAMPTZ` (com timezone)
- **Soft delete:** preferir `deleted_at TIMESTAMPTZ NULL` em vez de DELETE pra tabelas críticas (achievements, referrals)

### Aud-2 — Fórmula do `power_score`

```
power_score = SUM(daily_progress.xp_earned across all days)
            + SUM(achievement_definitions.xp_reward where unlocked)
            + bônus de streak milestone (+50 em 7d, +200 em 30d, +500 em 100d)
```

Atualizado via TRIGGER no banco (não em edge function — evita race condition):

```sql
CREATE OR REPLACE FUNCTION update_power_score()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET power_score = (
    COALESCE((SELECT SUM(xp_earned) FROM daily_progress WHERE user_id = NEW.user_id), 0)
    + COALESCE((SELECT SUM(ad.xp_reward) FROM user_achievements_v2 ua
                JOIN achievement_definitions ad ON ad.id = ua.achievement_id
                WHERE ua.user_id = NEW.user_id), 0)
    + COALESCE((SELECT
        CASE
          WHEN longest_streak >= 100 THEN 750  -- 50+200+500
          WHEN longest_streak >= 30 THEN 250   -- 50+200
          WHEN longest_streak >= 7 THEN 50
          ELSE 0
        END
       FROM user_streaks WHERE user_id = NEW.user_id), 0)
  )
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_daily_progress_power_score
AFTER INSERT OR UPDATE ON daily_progress
FOR EACH ROW EXECUTE FUNCTION update_power_score();
```

### Aud-3 — Patentes

5 níveis baseados em `power_score`:

| Patente | Faixa power_score |
|---------|-------------------|
| Iniciante | 0 — 99 |
| Operador | 100 — 499 |
| Praticante | 500 — 1.499 |
| Estrategista | 1.500 — 4.999 |
| Mestre | 5.000+ |

Calculado em runtime no frontend (não persiste).

### Aud-4 — Streak

- **Avança SÓ** quando aluno bate `daily_goal` (não basta abrir o app)
- **Gap de 1+ dia:** consome Streak Freeze se tiver; senão `current_streak = 1`
- Schema canônico abaixo na seção "Streak System"

### Aud-5 — Timezone

```sql
ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';
```

Detectado via `Intl.DateTimeFormat().resolvedOptions().timeZone` no primeiro acesso. Crons usam `AT TIME ZONE` por user.

### Aud-6 — Naming do projeto

- **"AI Academy"** em strings de UI
- **"AILIV"** em código interno

---

## Schema do Banco — Visão Unificada com SQL Completo

### Alterações em `users`

```sql
-- Migration: 20260520_alter_users_gamification.sql

ALTER TABLE users
  -- G1
  ADD COLUMN daily_goal_xp INT NOT NULL DEFAULT 20
    CHECK (daily_goal_xp IN (10, 20, 30, 50)),
  ADD COLUMN daily_goal_changed_at TIMESTAMPTZ,

  -- Fase 3 Hearts
  ADD COLUMN hearts INT NOT NULL DEFAULT 5
    CHECK (hearts >= 0 AND hearts <= 5),
  ADD COLUMN hearts_last_regen TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- G5 Combo
  ADD COLUMN best_combo INT NOT NULL DEFAULT 0,

  -- G8 Onboarding
  ADD COLUMN onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN onboarding_step INT NOT NULL DEFAULT 0
    CHECK (onboarding_step BETWEEN 0 AND 7),
  ADD COLUMN profession TEXT,
  ADD COLUMN learning_objective TEXT
    CHECK (learning_objective IN ('time', 'sales', 'organization', 'curiosity') OR learning_objective IS NULL),

  -- G9 Friend Quest
  ADD COLUMN referral_code TEXT UNIQUE,
  ADD COLUMN referred_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Decisão 4 Ultra
  ADD COLUMN ultra_plan_expires_at TIMESTAMPTZ,

  -- Aud-5 Timezone
  ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

-- DROP coluna legada (Decisão 3)
ALTER TABLE users DROP COLUMN IF EXISTS total_points;

-- Index pra referrals
CREATE INDEX idx_users_referral_code ON users (referral_code) WHERE referral_code IS NOT NULL;
```

### Alterações em `lessons` e `user_lessons`

```sql
-- Migration: 20260520_alter_lessons.sql

-- lessons: adicionar Boss flag
ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS is_boss_lesson BOOLEAN NOT NULL DEFAULT FALSE;

-- user_lessons: adicionar Crowns/Maestria
ALTER TABLE user_lessons
  ADD COLUMN mastery_level TEXT NOT NULL DEFAULT 'none'
    CHECK (mastery_level IN ('none', 'bronze', 'gold')),
  ADD COLUMN mastery_achieved_at TIMESTAMPTZ;
```

### Streak System (canônico)

```sql
-- Migration: 20260520_streak_system.sql

CREATE TABLE IF NOT EXISTS user_streaks (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak     INT NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak     INT NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  last_active_date   DATE,
  streak_start_date  DATE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_streaks_select ON user_streaks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_streaks_update ON user_streaks
  FOR UPDATE USING (auth.uid() = user_id);

-- Insert é feito via trigger no signup (não pelo user direto)
```

### G1 — Daily Goal

```sql
-- Migration: 20260520_g1_daily_goal.sql

CREATE TABLE daily_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  xp_earned       INT NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),
  goal_reached    BOOLEAN NOT NULL DEFAULT FALSE,
  goal_reached_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_progress_user_date ON daily_progress (user_id, date DESC);

ALTER TABLE daily_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY daily_progress_select ON daily_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY daily_progress_insert ON daily_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY daily_progress_update ON daily_progress
  FOR UPDATE USING (auth.uid() = user_id);
```

### G3 — Path Visual (trilha_progress)

```sql
-- Migration: 20260520_g3_path_visual.sql

CREATE TABLE trilha_progress (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trilha_id         UUID NOT NULL REFERENCES trilhas(id) ON DELETE CASCADE,
  lessons_completed INT NOT NULL DEFAULT 0 CHECK (lessons_completed >= 0),
  lessons_gold      INT NOT NULL DEFAULT 0 CHECK (lessons_gold >= 0),
  total_lessons     INT NOT NULL CHECK (total_lessons > 0),
  is_completed      BOOLEAN NOT NULL DEFAULT FALSE,
  is_mastered       BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, trilha_id)
);

CREATE INDEX idx_trilha_progress_user ON trilha_progress (user_id);

ALTER TABLE trilha_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY trilha_progress_user ON trilha_progress
  FOR ALL USING (auth.uid() = user_id);
```

### G7 — Notificações + LIV Phrases

```sql
-- Migration: 20260520_g7_notifications.sql

-- 1. Pool de frases da LIV (interno + notificações)
CREATE TABLE liv_phrases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase      TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN (
    'abertura', 'pre_exercicio', 'pos_acerto',
    'pos_erro', 'transicao', 'fechamento'
  )),
  tone        TEXT NOT NULL CHECK (tone IN (
    'idle', 'curious', 'encouraging',
    'proud', 'concerned', 'celebrating'
  )),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_liv_phrases_category_active
  ON liv_phrases (category, active);

ALTER TABLE liv_phrases ENABLE ROW LEVEL SECURITY;

-- SELECT público — todos os users podem ler frases ativas
CREATE POLICY liv_phrases_select_public ON liv_phrases
  FOR SELECT USING (active = TRUE);

-- 2. Log anti-repetição (por user)
CREATE TABLE liv_phrase_usage (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phrase_id   UUID NOT NULL REFERENCES liv_phrases(id) ON DELETE CASCADE,
  used_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_liv_phrase_usage_user_time
  ON liv_phrase_usage (user_id, used_at DESC);

ALTER TABLE liv_phrase_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY liv_phrase_usage_user ON liv_phrase_usage
  FOR ALL USING (auth.uid() = user_id);

-- 3. Templates de notificação
CREATE TABLE notification_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_key   TEXT NOT NULL UNIQUE,
  channel       TEXT NOT NULL CHECK (channel IN ('push', 'in_app', 'both')),
  title         TEXT NOT NULL,
  body_template TEXT NOT NULL,
  icon          TEXT,
  cta_url       TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_templates_active
  ON notification_templates (active) WHERE active = TRUE;

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_templates_select_public ON notification_templates
  FOR SELECT USING (active = TRUE);

-- 4. Log de envios
CREATE TABLE notification_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES notification_templates(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL CHECK (channel IN ('push', 'in_app')),
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at   TIMESTAMPTZ,
  clicked_at  TIMESTAMPTZ
);

CREATE INDEX idx_notif_log_user_sent ON notification_log (user_id, sent_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_log_user ON notification_log
  FOR SELECT USING (auth.uid() = user_id);

-- 5. Preferências de notificação
CREATE TABLE user_notification_preferences (
  user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  push_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  in_app_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  streak_reminders     BOOLEAN NOT NULL DEFAULT TRUE,
  achievement_alerts   BOOLEAN NOT NULL DEFAULT TRUE,
  daily_goal_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  inactivity_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours_start    TIME NOT NULL DEFAULT '22:00',
  quiet_hours_end      TIME NOT NULL DEFAULT '07:00',
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_notif_prefs_user ON user_notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- 6. Tokens de Push (Web Push API)
CREATE TABLE push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_push_subs_user ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_subs_user ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);
```

### Seed data — 6 templates de notificação

```sql
-- Migration: 20260520_seed_notification_templates.sql

INSERT INTO notification_templates (trigger_key, channel, title, body_template) VALUES
  ('daily_goal_reminder', 'both',
   'Falta pouco pra fechar o dia',
   'Oi {nome} — faltam só {xp_remaining} XP pra fechar seu dia.'),

  ('streak_at_risk_20h', 'both',
   'Sua sequência tá viva',
   '{nome}, sua sequência de {streak} dias tá viva. 2 minutos hoje preservam ela.'),

  ('inactivity_3_days', 'both',
   'Senti sua falta',
   'Senti sua falta. Tem 1 aula curta esperando — 4 minutos.'),

  ('daily_goal_reached', 'in_app',
   'Meta batida',
   '{nome}, você bateu sua meta. {streak} dias seguidos. Tô orgulhosa.'),

  ('achievement_unlocked', 'both',
   'Conquista desbloqueada',
   'Você acaba de desbloquear: {achievement_name}.'),

  ('streak_milestone', 'both',
   'Marco de sequência',
   '{streak} dias seguidos, {nome}. Forte.');
```

### G8 — Onboarding (não tem schema novo além das alterações em users)

(Vide alterações em `users` acima — campos `onboarding_*`, `profession`, `learning_objective`)

### G9 — Friend Quest

```sql
-- Migration: 20260520_g9_friend_quest.sql

CREATE TABLE referrals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  referred_email        TEXT,
  status                TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'registered', 'completed_first_lesson', 'expired')),
  coins_paid_signup     BOOLEAN NOT NULL DEFAULT FALSE,
  coins_paid_completion BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registered_at         TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX idx_referrals_referrer ON referrals (referrer_user_id, status);
CREATE INDEX idx_referrals_referred ON referrals (referred_user_id);
CREATE INDEX idx_referrals_expires ON referrals (expires_at) WHERE status = 'sent';

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY referrals_referrer ON referrals
  FOR SELECT USING (auth.uid() = referrer_user_id);
```

### G10 — XP Boost

```sql
-- Migration: 20260520_g10_xp_boost.sql

CREATE TABLE user_active_boosts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  boost_type    TEXT NOT NULL CHECK (boost_type IN ('xp_2x', 'xp_3x_future')),
  multiplier    NUMERIC(3,1) NOT NULL DEFAULT 2.0 CHECK (multiplier > 1.0),
  activated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  notified_3min BOOLEAN NOT NULL DEFAULT FALSE,
  status        TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'cancelled'))
);

CREATE INDEX idx_active_boosts_user_status ON user_active_boosts (user_id, status);
CREATE INDEX idx_active_boosts_expires ON user_active_boosts (expires_at) WHERE status = 'active';

ALTER TABLE user_active_boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_active_boosts_user ON user_active_boosts
  FOR ALL USING (auth.uid() = user_id);
```

### Fase 2 — Loja

```sql
-- Migration: 20260520_fase2_shop.sql

CREATE TABLE shop_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key    TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  cost_coins  INT NOT NULL CHECK (cost_coins > 0),
  category    TEXT NOT NULL CHECK (category IN (
    'protection', 'power', 'content', 'cosmetic'
  )),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY shop_items_select_public ON shop_items
  FOR SELECT USING (active = TRUE);

-- Seed dos 4 itens iniciais
INSERT INTO shop_items (item_key, name, description, cost_coins, category) VALUES
  ('streak_freeze', 'Streak Freeze', 'Protege sua sequência por 1 dia se você não entrar.', 200, 'protection'),
  ('heart_refill', 'Heart Refill', 'Restaura todos os 5 corações imediatamente.', 100, 'protection'),
  ('xp_boost', 'XP Boost', 'Próximos 15 minutos rendem o dobro de XP.', 150, 'power'),
  ('prompt_premium', 'Prompt Premium', 'Desbloqueia um prompt curado da biblioteca AI.', 1000, 'content');

CREATE TABLE user_shop_purchases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES shop_items(id) ON DELETE RESTRICT,
  coins_paid    INT NOT NULL CHECK (coins_paid > 0),
  purchased_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchases_user_time ON user_shop_purchases (user_id, purchased_at DESC);

ALTER TABLE user_shop_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY purchases_user ON user_shop_purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE user_streak_freezes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acquired_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_on_date  DATE,
  used_at       TIMESTAMPTZ
);

CREATE INDEX idx_streak_freezes_user_available
  ON user_streak_freezes (user_id) WHERE used_on_date IS NULL;

ALTER TABLE user_streak_freezes ENABLE ROW LEVEL SECURITY;

CREATE POLICY streak_freezes_user ON user_streak_freezes
  FOR ALL USING (auth.uid() = user_id);
```

### Fase 3 — Hearts System

```sql
-- Migration: 20260520_fase3_hearts.sql

-- (Campos hearts e hearts_last_regen já adicionados em alterações de users)

CREATE TABLE user_hearts_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action        TEXT NOT NULL CHECK (action IN ('lost', 'regen', 'refill_purchase', 'practice_reward', 'ultra_bypass')),
  hearts_before INT NOT NULL,
  hearts_after  INT NOT NULL,
  hearts_delta  INT NOT NULL,
  source        TEXT, -- ex: 'exercise:{lesson_id}', 'purchase:heart_refill'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hearts_log_user_time ON user_hearts_log (user_id, created_at DESC);

ALTER TABLE user_hearts_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY hearts_log_user ON user_hearts_log
  FOR SELECT USING (auth.uid() = user_id);

-- G6 — Practice to earn hearts
CREATE TABLE practice_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercises_total INT NOT NULL DEFAULT 5,
  exercises_correct INT NOT NULL DEFAULT 0,
  hearts_awarded  INT NOT NULL DEFAULT 0,
  completed       BOOLEAN NOT NULL DEFAULT FALSE,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_practice_user_date ON practice_sessions (user_id, started_at DESC);

ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY practice_user ON practice_sessions
  FOR ALL USING (auth.uid() = user_id);
```

### Fase 6 — Achievements 2.0

```sql
-- Migration: 20260520_fase6_achievements.sql

CREATE TABLE achievement_definitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_key TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  xp_reward       INT NOT NULL DEFAULT 0,
  coins_reward    INT NOT NULL DEFAULT 0,
  tier            TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold')),
  trigger_rules   JSONB NOT NULL, -- regras pra disparar (ex: {"lessons_completed": 10})
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE achievement_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY achievement_defs_select_public ON achievement_definitions
  FOR SELECT USING (active = TRUE);

-- 8 conquistas iniciais
INSERT INTO achievement_definitions (achievement_key, name, description, xp_reward, coins_reward, tier, trigger_rules) VALUES
  ('first_lesson', 'Primeiro Passo', 'Completou sua primeira aula.', 20, 5, 'bronze', '{"lessons_completed": 1}'),
  ('dedicated_learner', 'Aprendiz Dedicado', 'Completou 5 aulas.', 50, 15, 'bronze', '{"lessons_completed": 5}'),
  ('serious_student', 'Estudante Sério', 'Completou 10 aulas.', 100, 30, 'silver', '{"lessons_completed": 10}'),
  ('combo_master', 'Recorde Pessoal', 'Atingiu combo de 10 acertos.', 50, 20, 'silver', '{"best_combo": 10}'),
  ('first_insight', 'Primeiro Insight', 'Ganhou seu primeiro Insight (score ≥70).', 40, 15, 'bronze', '{"insights_count": 1}'),
  ('streak_7', 'Sete Dias', 'Manteve sequência de 7 dias.', 70, 25, 'silver', '{"streak": 7}'),
  ('streak_30', 'Maratonista', 'Manteve sequência de 30 dias.', 250, 100, 'gold', '{"streak": 30}'),
  ('first_friend', 'Primeiro Amigo', 'Convidou um amigo que completou a primeira aula.', 50, 20, 'bronze', '{"referrals_completed": 1}');

CREATE TABLE user_achievements_v2 (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievement_definitions(id) ON DELETE CASCADE,
  unlocked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements_v2 (user_id);

ALTER TABLE user_achievements_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_achievements_user ON user_achievements_v2
  FOR ALL USING (auth.uid() = user_id);
```

---

## Edge Functions — Detalhamento

### G1 — `on-xp-earned`

```typescript
// supabase/functions/on-xp-earned/index.ts
import { createClient } from 'jsr:@supabase/supabase-js'

interface XPEarnedInput {
  user_id: string
  xp_amount: number
  source: 'lesson' | 'exercise' | 'playground' | 'combo' | 'boost' | 'achievement' | 'streak_milestone'
  source_id?: string
}

interface XPEarnedOutput {
  current_xp_today: number
  daily_goal: number
  goal_reached_now: boolean
  power_score: number
  multiplier_applied: number
}

// LÓGICA:
// 1. Aplicar XP Boost ativo (se houver) — chama apply-boost-multiplier
// 2. Iniciar transaction
// 3. UPSERT em daily_progress pra hoje (xp_earned += xp_amount)
// 4. Buscar users.daily_goal_xp
// 5. Se xp_earned >= daily_goal_xp e goal_reached era false:
//    - Marca goal_reached = true, goal_reached_at = NOW()
//    - Chama update-streak (sub-rotina interna)
//    - Sinaliza goal_reached_now = true
// 6. Commit transaction (trigger update_power_score roda automaticamente)
// 7. Retornar estado
```

**Tratamento de race conditions:** usar `SELECT ... FOR UPDATE` na linha de `daily_progress` antes do UPSERT.

### G1 — `change-daily-goal`

```typescript
interface ChangeDailyGoalInput {
  user_id: string
  new_goal_xp: 10 | 20 | 30 | 50
}

// LÓGICA:
// 1. Buscar users.daily_goal_changed_at
// 2. Se NULL ou >= 7 dias atrás: permite. Senão: retorna erro com next_change_allowed_at.
// 3. UPDATE users.daily_goal_xp + daily_goal_changed_at = NOW()
```

### G3 — `get-trilha-path`

```typescript
interface GetTrilhaPathInput {
  user_id: string
  trilha_id: string
}

interface LessonPathNode {
  lesson_id: string
  title: string
  duration_minutes: number
  state: 'gold' | 'bronze' | 'current' | 'available' | 'locked'
  is_boss: boolean
  order_index: number
}

// LÓGICA:
// 1. Buscar todas as lessons WHERE trilha_id = $1 ORDER BY order_index
// 2. Buscar user_lessons do user pra essa trilha
// 3. Pra cada lesson, calcular o state:
//    - mastery_level === 'gold' → 'gold'
//    - mastery_level === 'bronze' → 'bronze'
//    - próxima após a última completa → 'current'
//    - depois da current → 'locked'
// 4. Retornar array ordenado
```

### G3 — `complete-lesson`

```typescript
interface CompleteLessonInput {
  user_id: string
  lesson_id: string
  score: number
  exercises_correct: number
  exercises_total: number
}

// LÓGICA:
// 1. Iniciar transaction
// 2. UPSERT user_lessons com status='completed', mastery_level='bronze'
// 3. UPDATE trilha_progress (lessons_completed += 1)
// 4. Se foi última aula da trilha: marca is_completed = true
// 5. Disparar conquistas via check-achievements
// 6. Disparar G7 track-referral-milestone (se for primeira aula do user)
// 7. Commit
```

### G3 — `replay-lesson-for-gold`

```typescript
// LÓGICA:
// 1. Verificar mastery atual = 'bronze' AND score >= 95 AND exercises_correct = exercises_total
// 2. Se sim: UPDATE mastery_level = 'gold', mastery_achieved_at = NOW()
// 3. UPDATE trilha_progress.lessons_gold += 1
// 4. Se lessons_gold = total_lessons: marca is_mastered = true → dispara celebração
```

### G5 — `on-combo-milestone`

```typescript
interface ComboMilestoneInput {
  user_id: string
  combo_count: 3 | 5 | 10
  lesson_id: string
}

// LÓGICA:
// 1. Determinar bônus baseado em combo_count:
//    3 → +2 XP
//    5 → +5 XP
//    10 → +10 XP + 5 coins
// 2. Chamar on-xp-earned com source='combo'
// 3. Se combo == 10: UPDATE users.coins += 5
// 4. Se combo_count > users.best_combo:
//    - UPDATE users.best_combo = combo_count
//    - Disparar conquista 'combo_master'
```

### G7 — `send-liv-notification`

```typescript
interface SendNotificationInput {
  user_id: string
  trigger_key: string
  vars: Record<string, string | number>
}

// LÓGICA:
// 1. Buscar template por trigger_key
// 2. Verificar user_notification_preferences:
//    - Push enabled? Categoria habilitada?
// 3. Verificar quiet hours pro user:
//    SELECT EXTRACT(HOUR FROM NOW() AT TIME ZONE users.timezone) ...
//    Se está em quiet hours: agendar pro próximo horário válido
// 4. Anti-spam: notification_log na última 24h pra esse trigger_key
//    Exceção: achievement_unlocked pode duplicar
// 5. Substituir variáveis no body_template ({nome}, {streak}, etc)
// 6. Enviar via Web Push API (se canal == 'push' || 'both')
// 7. INSERT em notification_log
```

### G7 — Crons

```typescript
// cron_daily_goal_reminder — Supabase pg_cron @ "0 * * * *" (toda hora UTC)
// Pra cada user_id:
//   Se EXTRACT(HOUR FROM NOW() AT TIME ZONE timezone) = 18:
//     Se NOT bateu daily_goal hoje:
//       send-liv-notification('daily_goal_reminder', { nome, xp_remaining })

// cron_streak_at_risk — @ "0 * * * *"
// Pra cada user com current_streak > 0:
//   Se EXTRACT(HOUR FROM NOW() AT TIME ZONE timezone) = 20:
//     Se NOT goal_reached hoje:
//       send-liv-notification('streak_at_risk_20h', { nome, streak })

// cron_inactivity_check — @ "0 * * * *"
// Pra cada user com last_login >= 3 dias atrás:
//   Se EXTRACT(HOUR FROM NOW() AT TIME ZONE timezone) = 9:
//     Verificar último cron de inatividade enviado (anti-spam 3 dias)
//     send-liv-notification('inactivity_3_days', { nome })
```

### G8 — `complete-onboarding`

```typescript
interface CompleteOnboardingInput {
  user_id: string
  profession: string
  learning_objective: 'time' | 'sales' | 'organization' | 'curiosity'
  daily_goal_xp: 10 | 20 | 30 | 50
  timezone: string
}

// LÓGICA:
// 1. UPDATE users com profession, learning_objective, daily_goal_xp, timezone
// 2. SET onboarding_completed_at = NOW(), onboarding_step = 7
// 3. INSERT daily_progress pra hoje (dia 1 do streak)
// 4. Chamar on-xp-earned com 10 XP, source='onboarding_bonus'
// 5. UPDATE users.coins += 5
// 6. INSERT user_achievements_v2 com first_lesson (concede automático no onboarding)
// 7. INSERT user_streaks (current_streak=1, last_active_date=hoje)
```

### G8 — `save-onboarding-step`

```typescript
// Autosave entre passos. UPDATE users.onboarding_step + dados parciais.
```

### G9 — `generate-referral-link`

```typescript
// LÓGICA:
// 1. Se users.referral_code existe: retorna URL
// 2. Senão: gera slug (Nome-XXXX), salva em users.referral_code
// 3. Retorna { url: 'https://ailiv.com/convite/{slug}', code: slug }
```

### G9 — `redeem-referral`

```typescript
// LÓGICA:
// 1. Buscar referrer por users.referral_code = código
// 2. Anti-fraude:
//    - Email idêntico ao referrer? Bloquear.
//    - IP idêntico nas últimas 24h? Flag pra revisão (não bloqueia).
// 3. INSERT em referrals (status='registered')
// 4. UPDATE new_user.referred_by_user_id
// 5. UPDATE users.coins += 100 (referrer)
// 6. UPDATE users.coins += 100 (new user)
// 7. UPDATE referrals.coins_paid_signup = TRUE
```

### G9 — `track-referral-milestone`

```typescript
// Chamado dentro de complete-lesson quando é a PRIMEIRA aula do user.
// LÓGICA:
// 1. Buscar referrals WHERE referred_user_id = user_id AND coins_paid_completion = FALSE
// 2. Se existe: UPDATE status='completed_first_lesson', coins_paid_completion=TRUE
// 3. UPDATE users.coins += 100 (referrer + user)
// 4. send-liv-notification ao referrer ('referral_milestone')
```

### G10 — `purchase-xp-boost`

```typescript
// LÓGICA:
// 1. SELECT users.coins WHERE id = user_id FOR UPDATE
// 2. Verificar coins >= 150
// 3. Verificar se já tem boost ativo (status='active' AND expires_at > NOW())
//    Se sim: RENOVA expires_at = NOW() + 15min (não acumula)
//    Se não: INSERT novo boost
// 4. UPDATE users.coins -= 150
// 5. INSERT em user_shop_purchases
// 6. Retorna { boost_active, expires_at, coins_remaining }
```

### G10 — `apply-boost-multiplier` (função helper, não edge function)

**Decisão de arquitetura:** É **função Postgres** (PL/pgSQL), não edge function. Razão: chamada DENTRO de transações da `on-xp-earned`, ganha consistência.

```sql
CREATE OR REPLACE FUNCTION apply_boost_multiplier(p_user_id UUID, p_base_xp INT)
RETURNS TABLE(final_xp INT, multiplier NUMERIC, boost_applied BOOLEAN) AS $$
DECLARE
  v_multiplier NUMERIC := 1.0;
  v_boost_active BOOLEAN := FALSE;
BEGIN
  SELECT multiplier, TRUE INTO v_multiplier, v_boost_active
  FROM user_active_boosts
  WHERE user_id = p_user_id
    AND status = 'active'
    AND expires_at > NOW()
  ORDER BY expires_at DESC
  LIMIT 1;

  IF v_boost_active THEN
    final_xp := (p_base_xp * v_multiplier)::INT;
    multiplier := v_multiplier;
    boost_applied := TRUE;
  ELSE
    final_xp := p_base_xp;
    multiplier := 1.0;
    boost_applied := FALSE;
  END IF;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
```

### G10 — `cron-expire-boosts`

```typescript
// Cron @ "* * * * *" (a cada minuto)
// 1. UPDATE user_active_boosts SET status='expired'
//    WHERE status='active' AND expires_at <= NOW()
// 2. Pra cada boost com expires_at - NOW() <= 3 minutos e notified_3min = FALSE:
//    - send-liv-notification('boost_expiring_3min')
//    - UPDATE notified_3min = TRUE
```

---

## Fases originais — detalhamento

### Fase 0 — Reparos cirúrgicos (4h)

**Bug B1** — `lesson-playground` não grava score, is_copy, playground_id, passed, similarity, evaluation_payload.
- **Fix:** adicionar campos ao INSERT em `supabase/functions/lesson-playground/index.ts`. Gemini já retorna score, só não grava.
- **Tempo:** 1h.

**Bug B2** — `usePromptAchievements.ts` escreve `power_score` direto no DB, bypassando RPC.
- **Fix:** substituir UPDATE manual por `registerGamificationEvent('exercise_correct', ...)`.
- **Tempo:** 1h.

**Bug B3** — Leaderboard filtro "Semana"/"Mês" é decorativo.
- **Fix:** remover botões do Leaderboard.tsx (Decisão Aud — Leaderboard vira "Ranking Geral" pós-Ligas).
- **Tempo:** 30 min.

**+1h pra QA e testes.**

### Fase 1 — Consolidação base (6h)

- Migration apagando `users.total_points` (1h)
- Migration criando tabela `achievement_definitions` + `user_achievements_v2` + seed das 8 conquistas (2h)
- Trigger `update_power_score()` instalado e testado (2h)
- Refactor de Leaderboard.tsx pra ler `power_score` (1h)

### Fase 2 — Loja enxuta (10h)

- Migrations dos 3 schemas: `shop_items`, `user_shop_purchases`, `user_streak_freezes` + seed dos 4 itens (1h)
- Edge functions: `use-streak-freeze`, `use-heart-refill`, `unlock-premium-prompt` (3h)
- Componente `<ShopPage>` com cards dos 4 itens (3h)
- Modal de confirmação de compra com transação atômica (1h)
- Testes manuais (2h)

### Fase 3 — Hearts System + G6 (14h)

- Migrations: `user_hearts_log`, `practice_sessions`, alterações em `users` (1h)
- Edge function `lose-heart` (chamada em on-exercise-wrong) (1h)
- Edge function `regen-hearts` (calculada client-side, sem cron — verifica `hearts_last_regen`) (2h)
- Edge function `generate-practice-session` — sorteia 5 exercícios de aulas completas (2h)
- Edge function `complete-practice-session` — verifica acertos e concede hearts (2h)
- Componente `<HeartsDisplay>` no header (1h)
- Componente `<PracticeSessionFlow>` (3h)
- Lógica de bloqueio: usuário sem hearts vê "sem hearts, vamos praticar?" (1h)
- Testes (1h)

### Fase 5 — Insights Playground (14h)

- Fix do Bug B1 (já contado na Fase 0 mas com expansão)
- Nova lógica em `register_gamification_event` pra `insight_claimed` com 3 tiers (3h)
- Edge function `claim-insight-bonus` (2h)
- Componente `<InsightHallPage>` mostrando histórico (3h)
- Hook `useInsightStreak` pra trackear 3 insights ouro seguidos (2h)
- Migrations e indexes (1h)
- Anti-cheat reforçado (cooldown 30s, similarity check) (2h)
- Testes (1h)

### Fase 6 — Achievements 2.0 (10h)

- Migrations e seed das 8 conquistas (1h — já feito na Fase 1)
- Edge function `check-achievements` chamada por triggers dos eventos relevantes (3h)
- Componente `<AchievementsPage>` listando todas + locked/unlocked (3h)
- Modal `<AchievementUnlockedModal>` quando desbloqueia (2h)
- Testes (1h)

---

## Mapa de Dependências

```
                  ┌───────────────────────┐
                  │ Fase 0 — Bugs (B1-B3) │
                  └───────────┬───────────┘
                              │
                  ┌───────────▼───────────┐
                  │ Fase 1 — Consolidação │
                  │ (matar total_points,  │
                  │  achievement_defs,    │
                  │  trigger power_score) │
                  └───────────┬───────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌──────────────┐                          ┌──────────────────┐
│ G1 Daily Goal│                          │ Streak System    │
└──────┬───────┘                          │ (user_streaks)   │
       │                                  └────────┬─────────┘
       ▼                                           │
┌──────────────┐                                   │
│ G3 Path      │                                   │
│ (com G4)     │                                   │
└──────┬───────┘                                   │
       │                                           │
       │                                           │
       ▼                                           │
┌──────────────────┐                               │
│ Fase 2 — Loja    │ ───────────┐                  │
│ (4 itens)        │            │                  │
└────────┬─────────┘            │                  │
         │                      │                  │
         ▼                      │                  │
┌──────────────────┐            │                  │
│ Fase 3 — Hearts  │            │                  │
│ + G6 practice    │            │                  │
└──────────────────┘            │                  │
                                │                  │
                                ▼                  ▼
                       ┌────────────────┐  ┌───────────────────┐
                       │ G8 Onboarding  │  │ G7 Notif LIV      │
                       │ (usa G1+G3+LIV)│  │ (cron + push)     │
                       └────────┬───────┘  └─────────┬─────────┘
                                │                    │
                        ┌───────┼────────────────────┘
                        ▼       ▼
                 ┌────────────┐ ┌──────────────┐
                 │ G5 Combo   │ │ G10 XP Boost │
                 └────────────┘ └──────────────┘

                                ▼
                       ┌──────────────────┐
                       │ G9 Friend Quest  │
                       │ (usa G7 + coins) │
                       └──────────────────┘

                       ┌──────────────────┐
                       │ Fase 5 — Insights│
                       │ Playground       │
                       └────────┬─────────┘
                                ▼
                       ┌──────────────────┐
                       │ Fase 6 —         │
                       │ Achievements 2.0 │
                       └──────────────────┘
```

---

## Tabelas — Visão Consolidada Final

### 18 tabelas a CRIAR

| Tabela | Gap/Fase | RLS |
|--------|----------|-----|
| `daily_progress` | G1 | user-scoped |
| `user_streaks` | Streak System | user-scoped |
| `trilha_progress` | G3 | user-scoped |
| `liv_phrases` | G7 | SELECT público |
| `liv_phrase_usage` | G7 | user-scoped |
| `notification_templates` | G7 | SELECT público |
| `notification_log` | G7 | user-scoped (SELECT) |
| `user_notification_preferences` | G7 | user-scoped |
| `push_subscriptions` | G7 | user-scoped |
| `shop_items` | Fase 2 | SELECT público |
| `user_shop_purchases` | Fase 2 | user-scoped (SELECT) |
| `user_active_boosts` | G10 | user-scoped |
| `user_streak_freezes` | Fase 2 | user-scoped |
| `user_hearts_log` | Fase 3 | user-scoped (SELECT) |
| `practice_sessions` | G6 | user-scoped |
| `achievement_definitions` | Fase 6 | SELECT público |
| `user_achievements_v2` | Fase 6 | user-scoped |
| `referrals` | G9 | referrer-scoped |

### Alterações em `users` (consolidado)

```sql
ALTER TABLE users
  -- G1
  ADD COLUMN daily_goal_xp INT NOT NULL DEFAULT 20 CHECK (daily_goal_xp IN (10, 20, 30, 50)),
  ADD COLUMN daily_goal_changed_at TIMESTAMPTZ,
  -- Fase 3
  ADD COLUMN hearts INT NOT NULL DEFAULT 5 CHECK (hearts >= 0 AND hearts <= 5),
  ADD COLUMN hearts_last_regen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- G5
  ADD COLUMN best_combo INT NOT NULL DEFAULT 0,
  -- G8
  ADD COLUMN onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN onboarding_step INT NOT NULL DEFAULT 0 CHECK (onboarding_step BETWEEN 0 AND 7),
  ADD COLUMN profession TEXT,
  ADD COLUMN learning_objective TEXT,
  -- G9
  ADD COLUMN referral_code TEXT UNIQUE,
  ADD COLUMN referred_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Decisão 4
  ADD COLUMN ultra_plan_expires_at TIMESTAMPTZ,
  -- Aud-5
  ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

ALTER TABLE users DROP COLUMN IF EXISTS total_points;
```

### Alterações em `user_lessons` e `lessons`

```sql
ALTER TABLE user_lessons
  ADD COLUMN mastery_level TEXT NOT NULL DEFAULT 'none' CHECK (mastery_level IN ('none', 'bronze', 'gold')),
  ADD COLUMN mastery_achieved_at TIMESTAMPTZ;

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS is_boss_lesson BOOLEAN NOT NULL DEFAULT FALSE;
```

---

## Edge Functions — Visão Consolidada Final

| Função | Tipo | Gap | Quando dispara |
|--------|------|-----|----------------|
| `on-xp-earned` | Edge | G1 | Toda vez que aluno ganha XP |
| `change-daily-goal` | Edge | G1 | Aluno troca meta no perfil |
| `update_power_score()` | Trigger PG | Aud-2 | AFTER INSERT/UPDATE em daily_progress |
| `get-trilha-path` | Edge | G3 | Aluno abre uma trilha |
| `complete-lesson` | Edge | G3 | Aluno termina aula |
| `replay-lesson-for-gold` | Edge | G3 | Aluno refaz aula com ≥95% |
| `on-combo-milestone` | Edge | G5 | Combo atinge 3, 5 ou 10 |
| `send-liv-notification` | Edge | G7 | Engine central de envio |
| `cron_daily_goal_reminder` | Cron | G7 | A cada hora UTC (verifica 18h local) |
| `cron_streak_at_risk` | Cron | G7 | A cada hora UTC (verifica 20h local) |
| `cron_inactivity_check` | Cron | G7 | A cada hora UTC (verifica 9h local) |
| `complete-onboarding` | Edge | G8 | Aluno termina onboarding |
| `save-onboarding-step` | Edge | G8 | Autosave entre passos |
| `generate-referral-link` | Edge | G9 | Aluno abre modal de convite |
| `redeem-referral` | Edge | G9 | Cadastro com `?ref=` |
| `track-referral-milestone` | Edge | G9 | Amigo completa aula 1 |
| `purchase-xp-boost` | Edge | G10 | Compra na Loja |
| `apply_boost_multiplier()` | Função PG | G10 | Chamada dentro de transações |
| `cron-expire-boosts` | Cron | G10 | A cada 1 minuto |
| `lose-heart` | Edge | Fase 3 | Errou exercício |
| `regen-hearts` | Client | Fase 3 | Verifica `hearts_last_regen` no client |
| `generate-practice-session` | Edge | G6 | Aluno clica "Practice to earn hearts" |
| `complete-practice-session` | Edge | G6 | Aluno termina practice |
| `use-streak-freeze` | Edge | Fase 2 | Sistema consome freeze ou aluno usa manual |
| `use-heart-refill` | Edge | Fase 2 | Aluno compra refill |
| `unlock-premium-prompt` | Edge | Fase 2 | Aluno compra prompt |
| `check-achievements` | Edge | Fase 6 | Disparado por triggers de eventos |
| `claim-insight-bonus` | Edge | Fase 5 | Aluno completa playground com score ≥70 |

---

## Tratamento de Race Conditions / Transactions

**Pontos críticos** que precisam de `SELECT ... FOR UPDATE`:

1. **`on-xp-earned` + `daily_progress`** — múltiplas chamadas concorrentes (combo + lição + boost) podem causar lost update.
2. **`purchase-xp-boost` + `users.coins`** — race entre 2 compras simultâneas pode debitar coins 2 vezes.
3. **`lose-heart` + `users.hearts`** — múltiplas perdas simultâneas em quizzes diferentes.
4. **`redeem-referral` + `users.coins`** — concede coins pra 2 lados, transação obrigatória.

**Padrão:** todas as edge functions críticas usam `pg_advisory_lock(hashtext(user_id::text))` no início da transação.

---

## Ordem de Implementação Recomendada

| # | Item | Horas | Acumulado |
|---|------|-------|-----------|
| 1 | Fase 0 — Bugs B1, B2, B3 | 4h | 4h |
| 2 | Fase 1 — Consolidação base + power_score trigger | 6h | 10h |
| 3 | G1 — Daily Goal | 7h | 17h |
| 4 | G3 — Path Visual (com G4) | 11h | 28h |
| 5 | Fase 2 — Loja enxuta | 10h | 38h |
| 6 | Fase 3 — Hearts + G6 practice to earn | 14h | 52h |
| 7 | G8 — Onboarding gamificado | 9h | 61h |
| 8 | G5 — Combo na lição | 5h | 66h |
| 9 | G7 — Notificações da LIV | 11h | 77h |
| 10 | G10 — XP Boost | 7h | 84h |
| 11 | G9 — Friend Quest | 8h | 92h |
| 12 | Fase 5 — Insights Playground | 14h | 106h |
| 13 | Fase 6 — Achievements 2.0 | 10h | 116h |
| **Total bruto** | | **116h** | |
| Com buffer 20% | | **~140h** | |

**3-4 semanas full-time.**

---

## Próximo passo

Este doc fecha o **Item 2** do roadmap, agora completo e auditado.

Próximo: **Item 3** — Mapa de telas/UX da gamificação (mockups HTML de cada tela nova).

Depois: **Item 4** — Revisar e fechar pool de 58 frases da LIV.

Depois dos 4 items completos, o pacote vai pro Claude Code começar a implementação MVP.

---

**Fim do documento.**
