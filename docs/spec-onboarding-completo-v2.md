# Spec Completo — Onboarding YesLiv (v2)

> **Versão 2 (maio/2026)** — auditoria robusta aplicada.
> Consolidação de 27 fixes + 7 decisões de design.
> Doc único — substitui `spec-onboarding-completo.md`, `spec-onboarding-v2.md` e `spec-sprint4-mini-experiencia-ia.md`.
> Custo runtime: **R$ 0** (zero chamadas de API).
> Tempo total aluno: **5-7 minutos**.

---

## 📑 Sumário

1. [Críticos pro Claude Code](#críticos-pro-claude-code)
2. [Changelog v2 — o que mudou](#changelog-v2--o-que-mudou)
3. [Visão geral — 13 telas](#visão-geral--13-telas)
4. [Princípios fundadores](#princípios-fundadores)
5. [Schema do banco consolidado](#schema-do-banco-consolidado)
6. [Componentes React + Assets](#componentes-react--assets)
7. [FASE 0 — Infraestrutura](#fase-0--infraestrutura)
8. [FASE 1 — Wizard de Coleta (Telas 1-9)](#fase-1--wizard-de-coleta-telas-1-9)
9. [FASE 2 — Desafio (Tela 10, 9 sub-telas)](#fase-2--desafio-tela-10-9-sub-telas)
10. [FASE 3 — Reveal + Cadastro (Telas 11-13)](#fase-3--reveal--cadastro-telas-11-13)
11. [FASE 4 — Polish e testes](#fase-4--polish-e-testes)
12. [Cenários extremos](#cenários-extremos)
13. [O que NÃO fazer](#o-que-não-fazer)
14. [Plano total de horas](#plano-total-de-horas)

---

## ⚠️ Críticos pro Claude Code

**Quatro itens são OBRIGATÓRIOS e bloqueantes. Implementação não pode prosseguir sem eles:**

### 1. Barra de Domínio IA (Tela 10 inteira)

- Componente `<DominioBar />` fixo no topo do Desafio
- Anima ao ganhar pontos (suave, 300ms)
- Mostra número atual + barra 0-100 (cap real em 100, não 115)
- Estados visuais:
  - 0-44: cor neutra
  - 45-69: cor azul
  - 70-89: cor verde
  - 90+: cor laranja com glow (🔥)
- Toast de combo sobre a barra: "🔥 2 seguidas! +3 bônus"

### 2. Vidas (❤️) visíveis no header — durante todo o Desafio

- Componente `<HeartsBar />` no header da Tela 10, lado direito
- 5 corações cheios desde a sub-tela 1/9
- Cada erro de quiz (T2, T3, T4, T7) → 1 coração 🤍 com animação shake + fade (300ms)
- NÃO bloqueia o aluno se chegar a 0 vidas no Desafio (só visual)
- Tooltip: *"Vidas são suas tentativas. Você recupera no Mistake Review."*

### 3. Notification permission via GESTURE-BASED, nunca automático

- iOS Safari **bloqueia** `Notification.requestPermission()` sem gesture do usuário
- Implementação obrigatória: prompt nativo só dispara **no click** do botão `[PERMITIR LEMBRETES]`
- Nada de auto-trigger via `useEffect` ou `onMount` — sempre `onClick`

### 4. Deferred account creation com persistência de 7 dias

- NÃO pedir cadastro antes da Tela 13
- Aluno faz wizard + DESAFIO inteiro sem fricção de email/senha
- Progresso fica em sessionStorage + cookie `deferred_session_token` (TTL 7 dias)
- Se aluno escolher "DEPOIS" no cadastro, cookie persiste e oferece recuperação no próximo acesso

### Outros itens críticos

- **Sparks ⚡, NÃO Cristais 💎** — em qualquer UI/código que mencione moeda, usar "Sparks"
- **Custo R$ 0** — todas as respostas de IA no onboarding são mockadas. NUNCA chamar API real
- **Hook Emocional (Tela 4)** — NÃO tem progress bar. Progress bar começa na Tela 3 (Atribuição)
- **Domínio IA cap real em 100** — combo bonus que estouraria 100 fica capado em 100 (UI + DB)
- **YesLiv (sem "App" ou "Plataforma")** — usar só "YesLiv" como nome do produto

---

## 📝 Changelog v2 — o que mudou

| # | Mudança | Por quê | Severidade |
|---|---------|---------|------------|
| 1 | Hook emocional virou **Tela 4** (era Tela 3). Atribuição virou **Tela 3** (era Tela 4) | Capturar atribuição cedo (mesmo se aluno abandona) | 🟠 Médio |
| 2 | Copy LIV apresenta: **"dominar IA pra trabalho, projetos, vida"** (não só "trabalho") | Curso não é só pra trabalho | 🔴 Crítico |
| 3 | Hook trocado pra **Dario Amodei + METADE dos empregos** (não mais Economist/cavalo) | Fonte falsa anterior + cavalo dehumaniza | 🔴 Crítico |
| 4 | Copy Nível IA: **"Qual é seu nível com IA hoje?"** | "Quanto você usa" era ruim | 🔴 Crítico |
| 5 | Copy Daily Goal: **"Qual vai ser a sua meta diária?"** | Futuro = compromisso | 🟠 Médio |
| 6 | "Jornada" → "**caminho**" em 2 lugares | Jornada = jargão corporate | 🔴 Crítico |
| 7 | "Bora" reduzido pra 2 ocorrências (era 6) | Soava gírioso demais | 🟠 Médio |
| 8 | "Vantagem injusta" removido | Tradução de coach gringo | 🟠 Médio |
| 9 | "91%" agora referencia fonte (Inforchannel 2025) | Risco de questionamento | 🔴 Crítico |
| 10 | Notification dispara **no click**, não automático | iOS Safari bloqueia auto-trigger | 🔴 Crítico |
| 11 | DEPOIS na Tela 13 persiste por 7 dias (cookie) | Aluno investiu 5-7min, não pode perder | 🔴 Crítico |
| 12 | Schema: `user_id` virou NULLABLE, vinculo via `session_id` | user_id não existe antes do cadastro | 🔴 Crítico |
| 13 | Mensagem 30-49 reescrita pra não humilhar | "Você tá começando" depois de 4 erros doía | 🔴 Crítico |
| 14 | Opções de Nível mais claras | "Já mexi um pouco" era vago | 🟠 Médio |
| 15 | Bullets da Promise concretos | "Dominar" e "produtividade" eram abstratos | 🟠 Médio |
| 16 | Subtítulo Daily Goal: "Sem cobrança. Você ajusta quando quiser." | Mais direto | 🟠 Médio |
| 17 | Persona quiz: "especialista experiente da área" (não "Diretor de Criação") | Universal | 🟠 Médio |
| 18 | Chips V5: "Quero um [VERBO] para [QUEM]..." (não "Crie um") | Mais natural | 🟠 Médio |
| 19 | Tela 13: "Salve o que você fez." (não "Hora de criar seu perfil!") | Sem entusiasmo falso | 🟠 Médio |
| 20 | "Grátis" removido do Cadastro | Sem ambiguidade de pricing | 🟠 Médio |
| 21 | Vidas regen: **3h** (decisão fechada) | Meio termo entre 1h e 6h | 🟠 Médio |
| 22 | Critique Loop: "explica o que mudou" (não "justifique") | Menos hostil | 🟠 Médio |
| 23 | Final Reveal: "Você acabou de provar que sabe usar IA." | Fecha ciclo emocional | 🟠 Médio |
| 24 | Patente "Novato Nv 1" aparece na Tela 11 | Diferencial YesLiv | 🟡 Baixo |
| 25 | Pausa Antecipação: 1s + fade animado (não 2-3s seco) | Não parecer bug | 🟡 Baixo |
| 26 | "Customização" → "personalização" | Menos técnico | 🟡 Baixo |
| 27 | UAU 2 chips: "🎓 Curso/estudo" no lugar de "🚀 Investidor" | Menos business-heavy | 🟡 Baixo |
| 28 | Schema: Domínio cap em 100 (não 115) | Consistência | 🟡 Baixo |
| 29 | Choose Path: dado usado pra recomendação pós-desafio | Faz a escolha valer algo | 🟠 Médio |
| 30 | Combo não retroativo via Mistake Review | Não misturar economias | 🟡 Baixo |
| 31 | Lembrar de mim no form de cadastro | UX padrão | 🟡 Baixo |
| 32 | Vídeos: H.264 baseline MP4 + fallback WebM | Compat Safari iOS | 🟡 Baixo |

**Total:** 32 mudanças aplicadas (27 da auditoria + 5 refinos adicionais).

---

## 🗺️ Visão geral — 13 telas

```
┌─────────────────────────────────────────────────────────────────┐
│                       WIZARD COMPLETO                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FASE 1 — COLETA (Telas 1-9)                                    │
│  ─────────────────────────────                                  │
│   1. Landing                                                    │
│   2. LIV se apresenta                                           │
│   3. Atribuição                              ▓░░░░░░░░ (10%)    │
│   4. HOOK EMOCIONAL (Amodei — METADE empregos) (sem barra)      │
│   5. Motivação                               ▓▓░░░░░░░ (22%)    │
│   6. Nível atual de IA                       ▓▓▓░░░░░░ (33%)    │
│   7. Tela de Promise                         ▓▓▓▓░░░░░ (45%)    │
│   8. Daily Goal                              ▓▓▓▓▓░░░░ (56%)    │
│   9. Choose Path                             ▓▓▓▓▓▓░░░ (67%)    │
│                                                                  │
│  FASE 2 — DESAFIO (Tela 10, 9 sub-telas)    ▓▓▓▓▓▓▓░░ (78%)    │
│  ────────────────────────────────────────                       │
│    1/9 Filtro de Interesse              [Domínio +5]            │
│    2/9 Erro de Input        Quiz fácil  [Domínio +15] [❤️]      │
│    3/9 Persona              Quiz médio  [Domínio +20] [❤️]      │
│    4/9 Contexto (Viagem)    Quiz hard   [Domínio +25] [❤️]      │
│    5/9 UAU 1 (Visual/Esc.)              [Domínio +10]           │
│    6/9 UAU 2 (Chips V5)                 [Domínio +15]           │
│    7/9 UAU 3 (Critique Loop) Quiz hard  [Domínio +10] [❤️]      │
│    8/9 MISTAKE REVIEW                   [recupera ❤️+⚡Sparks]   │
│    9/9 Antecipação                                              │
│                                                                  │
│  FASE 3 — REVEAL + CADASTRO (Telas 11-13)                       │
│  ────────────────────────────────────────                       │
│   11. Reveal Orgânico (XP+Streak+Sparks+Vidas+Patente)          │
│                                                  ▓▓▓▓▓▓▓▓ (89%) │
│   12. Notification Primer (gesture-based)        ▓▓▓▓▓▓▓▓ (95%) │
│   13. Cadastro (deferred, 7 dias cookie)         ▓▓▓▓▓▓▓▓(100%) │
│                                                                  │
│           ↓                                                      │
│   [ENTRA NA HOME / TRILHA 1]                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Princípios fundadores

1. **Custo zero em runtime** — sem chamada de API. Tudo mockup.
2. **Mascote (LIV) presente desde cedo** — Tela 2.
3. **Tom leve, sem framing negativo** — Hook é exceção controlada (com fonte real).
4. **Deferred account creation** — cadastro APÓS valor entregue.
5. **Coleta dados que SERVEM pro produto** — não dado morto.
6. **Atribuição cedo** — antes do Hook, capturar dado de marketing mesmo se aluno abandona.
7. **Termina dentro do produto** — Desafio é placement real.
8. **XP/Streak/Sparks entram DENTRO da lição** — não em "tela mágica" pré-experiência.
9. **Pede notificação DEPOIS do "aha moment"** + gesture-based.
10. **Hook Emocional ANTES da coleta densa** — cria urgência sem dehumanizar.
11. **Escopo amplo: trabalho, projetos, vida** — nunca só "trabalho".
12. **UAU é UAU, não fofo** — exemplos REAIS, dimensão tangível.
13. **Erro educa** — feedback contextual, sem desconto de pontos.
14. **Aluno BUILDA com as mãos** — chips V5, não escolha entre prontos.
15. **Nunca pune** — só não ganha.
16. **Economia ensinada em contexto** — Vidas + Sparks via Mistake Review, sem tutorial.
17. **Linguagem direta** — adulto profissional, sem coach-fala, sem gírias em excesso.

---

## 🗃️ Schema do banco consolidado

```sql
-- ============================================================
-- TABELA: users (atualizada com gamificação)
-- ============================================================
ALTER TABLE users
  ADD COLUMN hook_answer TEXT
    CHECK (hook_answer IN ('torcer', 'garantir')),
  ADD COLUMN attribution_source TEXT,
  ADD COLUMN learning_objective TEXT,
  ADD COLUMN ai_usage_level TEXT
    CHECK (ai_usage_level IN ('nunca', 'testei', 'as_vezes', 'todo_dia')),
  ADD COLUMN daily_goal_xp INT DEFAULT 20
    CHECK (daily_goal_xp IN (10, 20, 30, 50)),
  ADD COLUMN path_choice TEXT
    CHECK (path_choice IN ('zero', 'placement')),
  ADD COLUMN notif_permission TEXT
    CHECK (notif_permission IN ('granted', 'denied', 'default')),
  -- gamificação
  ADD COLUMN hearts_current INT DEFAULT 5
    CHECK (hearts_current BETWEEN 0 AND 5),
  ADD COLUMN hearts_last_lost_at TIMESTAMPTZ,  -- pra calcular regen 3h
  ADD COLUMN sparks_balance INT DEFAULT 0
    CHECK (sparks_balance >= 0),
  ADD COLUMN xp_total INT DEFAULT 0
    CHECK (xp_total >= 0),
  ADD COLUMN streak_days INT DEFAULT 0
    CHECK (streak_days >= 0),
  ADD COLUMN patente_level INT DEFAULT 1
    CHECK (patente_level >= 1);

-- ============================================================
-- TABELA: onboarding_v2_answers (respostas do wizard + desafio)
-- ============================================================
CREATE TABLE onboarding_v2_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- vínculo: session_id obrigatório, user_id nullable até cadastro
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  deferred_session_token TEXT UNIQUE,  -- cookie de 7 dias
  deferred_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Sub-tela 1 do desafio
  filter_interest TEXT
    CHECK (filter_interest IN ('visual', 'writing')),

  -- Quiz responses (Sub-telas 2, 3, 4, 7 do desafio)
  quiz_t2_answer TEXT,
  quiz_t2_correct BOOLEAN,
  quiz_t3_answer TEXT,
  quiz_t3_correct BOOLEAN,
  quiz_t4_answer TEXT,
  quiz_t4_correct BOOLEAN,
  quiz_t7_answer TEXT,
  quiz_t7_correct BOOLEAN,

  -- UAU 1
  uau1_style TEXT,
  uau1_theme TEXT,
  uau1_writing TEXT,

  -- UAU 2 — Chips V5 Builder
  uau2_verb TEXT,
  uau2_who TEXT,
  uau2_tone TEXT,
  uau2_intent TEXT,
  uau2_prompt_built TEXT,

  -- Mistake Review
  hearts_lost_in_desafio INT DEFAULT 0
    CHECK (hearts_lost_in_desafio BETWEEN 0 AND 4),
  mistake_review_attempted BOOLEAN DEFAULT false,
  mistake_review_recovered INT DEFAULT 0
    CHECK (mistake_review_recovered BETWEEN 0 AND 4),
  mistake_review_sparks INT DEFAULT 0
    CHECK (mistake_review_sparks >= 0),

  -- Pontuação final
  ai_dominio_score INT
    CHECK (ai_dominio_score >= 0 AND ai_dominio_score <= 100),
  ai_dominio_level TEXT
    CHECK (ai_dominio_level IN ('iniciante', 'curioso', 'intermediario', 'avancado'))
);

CREATE INDEX idx_onboarding_session ON onboarding_v2_answers(session_id);
CREATE INDEX idx_onboarding_token ON onboarding_v2_answers(deferred_session_token)
  WHERE deferred_session_token IS NOT NULL;
```

**Lógica do deferred:**
1. No início do wizard, gerar UUID v4 → salvar como `session_id` em sessionStorage
2. Criar row em `onboarding_v2_answers` com `session_id` (sem user_id)
3. A cada tela, UPDATE WHERE session_id = X
4. Na Tela 13:
   - **CRIAR PERFIL** → cria `users`, faz UPDATE onboarding SET user_id = users.id
   - **DEPOIS** → gera `deferred_session_token` (UUID), salva em cookie 7 dias, retorna pra home

**Lógica do hearts regen (3h):**
- Quando hearts < 5: calcular `(NOW - hearts_last_lost_at) / 3h` = vidas a recuperar
- UPDATE hearts_current = LEAST(5, hearts_current + vidas_recuperadas)
- Se vidas_recuperadas > 0, atualizar hearts_last_lost_at = NOW

---

## 🧩 Componentes React + Assets

### Componentes

| Componente | Função | Fase |
|------------|--------|------|
| `<WizardShell />` | Layout + roteamento entre 13 telas (state machine) | 0 |
| `<ProgressBar />` | Barra superior (10% → 100%) | 0 |
| `<LivBubble />` | Bubble com balão da LIV (foto/vetor + texto) | 0 |
| `<LivVideo />` | Player de vídeo (apresenta, celebrating, etc) com fallback WebM | 0 |
| `<ChoiceCard />` | Card de escolha (chips, radio, multi-select) | 0 |
| `<HeartsBar />` | **OBRIGATÓRIO.** 5 corações no header do Desafio. Anima erro/recovery. | 0 |
| `<DominioBar />` | **OBRIGATÓRIO.** Barra de Domínio IA fixa no topo. Anima pontos + estados visuais. | 0 |
| `<SessionManager />` | Gera/recupera session_id, persiste em sessionStorage + cookie | 0 |
| `<HookScreen />` | Tela 4 — quote Amodei + 2 opções | 1 |
| `<NotifPrimer />` | Tela 12 — botão dispara prompt nativo NO CLICK (gesture-based) | 3 |
| `<QuizFeedback />` | Toast/banner com feedback contextual | 2 |
| `<ComboToast />` | "🔥 2 seguidas! +3 bônus" | 2 |
| `<MockupImageGen />` | UAU 1 Visual | 2 |
| `<EmailRewriter />` | UAU 1 Escrita | 2 |
| `<ChipsV5Builder />` | UAU 2 — 4 lacunas + categorias (adapta GuidedPlayground V5) | 2 |
| `<CritiqueLoopReveal />` | UAU 3 — animação antes/depois | 2 |
| `<MistakeReview />` | Sub-tela 8/9 — orquestra retry + reward + explainer | 2 |
| `<AntecipacaoTela />` | Sub-tela 9/9 — leitura emocional (pausa 1s + fade) | 2 |
| `<FinalReveal />` | Tela 11 — pontuação + recompensas + Patente | 3 |
| `<CadastroForm />` | Tela 13 — email/senha + Google + "Manter conectado" | 3 |

### Assets

**Vídeos (H.264 baseline MP4 + fallback WebM):**
- `liv-oi.mp4` — Tela 2 (acenando, loop 4s)
- `liv-thinking.mp4` — UAU 1/3 (pensando 2s)
- `liv-cheer.mp4` — Mistake Review reward
- `liv-clap.mp4` — Tela 11 Final Reveal
- `liv-point-up.mp4` — Tela 12 Notification primer
- `liv-point-up-save.mp4` — Tela 13 Cadastro

**Imagens UAU 1 Visual:** 9 imagens em `/public/uau-images/`
```
realista-paisagem.png    cartoon-paisagem.png   foto-paisagem.png
realista-futurista.png   cartoon-futurista.png  foto-futurista.png
realista-natureza.png    cartoon-natureza.png   foto-natureza.png
```

**Sons (opcional, gesture-based, try/catch mute):**
- `correct.mp3` / `wrong.mp3`
- `chip-select.mp3`
- `heart-lose.mp3` / `heart-gain.mp3`
- `spark-gain.mp3`

---

# 🏗️ FASE 0 — Infraestrutura

**Objetivo:** estrutura técnica que tudo depende.

**Tempo estimado:** 6h

### Entregáveis

1. Migration SQL aplicada (`users` + `onboarding_v2_answers` com schema novo)
2. `<WizardShell />` com roteamento entre 13 telas (state machine)
3. `<SessionManager />` — gera session_id (UUID v4), persiste em sessionStorage + cookie 7 dias
4. `<ProgressBar />`, `<LivBubble />`, `<LivVideo />`, `<ChoiceCard />`
5. **`<DominioBar />`** funcionando (mock de pontos, animação 300ms, 4 estados visuais)
6. **`<HeartsBar />`** funcionando (5 corações, animação shake+fade ao perder, fade-in ao recuperar)
7. Smoke test: rotear das 13 telas com botões dummy + verificar persistência

### Critérios de aceite

- [ ] Migration roda sem erro
- [ ] Conseguir rotear das 13 telas (Landing → Cadastro) com componentes vazios
- [ ] `<DominioBar />` aceita props `currentScore`, anima ao mudar, muda cor por faixa
- [ ] `<HeartsBar />` aceita props `lives` (0-5), anima perda (shake+fade) e recovery (fade-in)
- [ ] sessionStorage persiste respostas entre telas (recarrega sem perder)
- [ ] Cookie `deferred_session_token` criado com TTL 7 dias

---

# 🧭 FASE 1 — Wizard de Coleta (Telas 1-9)

**Objetivo:** coletar dados + criar vínculo emocional + provocar urgência (Hook).

**Tempo estimado:** 9h

---

## Tela 1 — Landing

| Elemento | Conteúdo |
|----------|----------|
| Headline | "Domine a IA e Transforme Sua Vida em 28 Dias" |
| Subtítulo | "Vamos personalizar seu caminho com algumas perguntas rápidas" |
| Microcopy | "Leva 4 minutos" |
| CTA primário | COMECE AGORA (botão gradiente roxo-azul) |
| CTA secundário | JÁ TENHO UMA CONTA (link/botão branco) |
| Mascote | Não (Landing é antes da LIV se apresentar) |

---

## Tela 2 — LIV se apresenta

| Elemento | Conteúdo |
|----------|----------|
| Centro da tela | `<LivVideo src="liv-oi.mp4" loop />` |
| Balão da LIV | **"Oi! Sou a LIV. Vou te ajudar a dominar IA pra usar onde você quiser — trabalho, projetos, vida. Vamos começar?"** |
| CTA | CONTINUAR (botão verde forte) |
| Progress bar | NÃO mostra ainda (começa na Tela 3) |

**Por que:** Duolingo apresenta o Duo na 3ª tela. Cria vínculo emocional ANTES de pedir dado. Copy reflete escopo amplo (não só trabalho).

---

## Tela 3 — Atribuição

| Elemento | Conteúdo |
|----------|----------|
| LIV | Foto/vetor canto superior esquerdo |
| Pergunta | "Como você conheceu a YesLiv?" |
| Progress bar | 10% |
| Opções | 6 cards: 📱 Instagram, 🔍 Google, ▶ TikTok, 👥 Amigo/Família, 📺 YouTube, 📰 Outro |
| CTA | CONTINUAR (desabilitado até selecionar) |

**Dado:** `users.attribution_source`. Capturado **cedo** pra não perder se aluno abandona depois.

---

## Tela 4 — HOOK EMOCIONAL

**Cria urgência ANTES das perguntas densas. Fonte real, sem dehumanização.**

```
[Sem barra de progresso]

Dario Amodei é o CEO da Anthropic — a 
empresa por trás do Claude, uma das IAs 
mais usadas do planeta.

Ele disse este ano:

"A IA pode eliminar METADE dos empregos
 de escritório de início e meio de carreira."

Metade. Você vai...

┌──────────────────────────────────────┐
│ 🤞  Torcer pra não ser o meu          │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ 🎯  Garantir que vou estar do lado    │
│     de quem USA a IA                  │
└──────────────────────────────────────┘
```

| Elemento | Conteúdo |
|----------|----------|
| LIV | Foto pequena no canto superior esquerdo |
| Fonte | "Dario Amodei, CEO da Anthropic, 2026" (visível abaixo do quote) |
| Opções | 2 cards (torcer / garantir) |
| Feedback (se 🎯 Garantir) | *"Boa. Você não tá esperando — você tá agindo. Esse é o lado que vai usar a IA, não ser usado por ela."* |
| Feedback (se 🤞 Torcer) | *"Honestidade rara. Torcer é o que 90% faz. Você tá aqui, então parte de você sabe que torcer não vai bastar. Vamos."* |

**Dado coletado:** `users.hook_answer` = 'torcer' | 'garantir'

**Por que vem aqui (Tela 4):** Atribuição (Tela 3) capturou marketing. Agora Hook cria urgência ANTES das perguntas densas (Motivação, Nível, Promise, Daily Goal). Aluno responde o resto emocionalmente ativado.

**Nota internacionalização:** versão americana — manter Amodei (universal), adaptar "empresa por trás do Claude" se Claude não for referência forte no mercado-alvo.

---

## Tela 5 — Motivação

| Elemento | Conteúdo |
|----------|----------|
| LIV | Canto superior esquerdo |
| Pergunta | "O que mais quer alcançar?" |
| Subtítulo | "Vamos personalizar sua trilha" |
| Progress bar | 22% |
| Opções | 5 cards:<br>💰 Gerar renda extra<br>🚀 Crescimento profissional<br>⚡ Aumentar produtividade<br>🏠 Planejar meu futuro<br>🧠 Curiosidade |
| CTA | CONTINUAR |

**Dado:** `users.learning_objective`.

---

## Tela 6 — Nível atual de IA

| Elemento | Conteúdo |
|----------|----------|
| LIV | Canto superior esquerdo |
| Pergunta | **"Qual é seu nível com IA hoje?"** |
| Progress bar | 33% |
| Opções | 4 cards:<br>😬 Nunca usei IA<br>🤔 Já testei algumas vezes<br>😊 Uso de vez em quando<br>😎 Uso todo dia |
| CTA | CONTINUAR |

**Dado:** `users.ai_usage_level` ('nunca', 'testei', 'as_vezes', 'todo_dia'). Calibra dificuldade do DESAFIO.

---

## Tela 7 — Tela de Promise

| Elemento | Conteúdo |
|----------|----------|
| LIV | Foto realista grande no topo |
| Headline | "Em 28 dias com a YesLiv você vai..." |
| Bullets (3) | 🎯 Saber montar prompts que entregam resultado, não texto genérico<br>💼 Resolver em 10 minutos o que levava manhãs inteiras<br>🚀 Sair do grupo dos 91% que ainda não saca de IA |
| Progress bar | 45% |
| CTA | CONTINUAR |
| Fonte (inline HTML comment) | `<!-- 91% baseado em Inforchannel 2025: apenas 9% dos departamentos financeiros usam IA estruturalmente -->` |

**Por que:** bullets concretos, com imagem mental clara, sem palavras vazias ("dominar", "produtividade pura").

---

## Tela 8 — Daily Goal

| Elemento | Conteúdo |
|----------|----------|
| LIV | Canto superior esquerdo |
| Pergunta | **"Qual vai ser a sua meta diária?"** |
| Subtítulo | **"Sem cobrança. Você ajusta quando quiser."** |
| Progress bar | 56% |
| Opções | 4 cards horizontais:<br>**10 XP — Casual** (~5 min)<br>**20 XP — Regular** (~10 min) ← default<br>**30 XP — Sério** (~15-20 min)<br>**50 XP — Intenso** (~25-30 min) |
| CTA | CONTINUAR |

**Dado:** `users.daily_goal_xp`.

---

## Tela 9 — Choose Path

| Elemento | Conteúdo |
|----------|----------|
| LIV | Canto superior esquerdo |
| Pergunta | "Agora vamos achar onde você começa." |
| Progress bar | 67% |
| Opção 1 | 📘 **Começar do zero** — "Faça a aula mais fácil pra entender a base" |
| Opção 2 | 🧭 **Encontrar meu nível** — "A LIV vai recomendar por onde você começa baseado no desafio" |
| CTA | CONTINUAR |

**Dado:** `users.path_choice` ('zero' | 'placement').

**Decisão funcional:** **ambos vão pro DESAFIO**, mas o dado é usado na recomendação pós-desafio:
- `path_choice = 'zero'` → na Tela 11 (Reveal), mensagem inclui: *"Você escolheu começar do zero — sua trilha começa na Aula 1 (Fundamentos da IA)."*
- `path_choice = 'placement'` → mensagem: *"Baseado no seu Domínio IA, recomendamos começar na Trilha X / Aula Y."*

### Critérios de aceite — FASE 1

- [ ] Todas as 9 telas renderizam corretamente
- [ ] Progress bar incrementa: 10% → 22% → 33% → 45% → 56% → 67% (Tela 4 não tem barra)
- [ ] Hook Emocional (Tela 4) salva `hook_answer` e mostra feedback condicional
- [ ] Atribuição (Tela 3) salva ANTES do Hook — dado capturado mesmo se aluno abandona Tela 4+
- [ ] Respostas persistem no sessionStorage
- [ ] LIV aparece em todas as telas relevantes (foto ou vídeo)
- [ ] CTA "CONTINUAR" desabilita até seleção válida

---

# 🎯 FASE 2 — Desafio (Tela 10, 9 sub-telas)

**Objetivo:** WOW moment + medir Domínio IA + ensinar economia (Vidas + Sparks).

**Tempo estimado:** 14h

**Header durante TODO o Desafio:**
```
[Logo YesLiv] [Progress 78%] | Domínio IA: XX | ❤️❤️❤️❤️❤️
                                  └ DominioBar       └ HeartsBar
```

---

## Sistema de Pontuação — "Domínio IA"

| Sub-tela | Tipo | Pontos acerto | Pontos erro | Vidas |
|----------|------|---------------|-------------|-------|
| 1/9 — Filtro de Interesse | Escolha pessoal | +5 | n/a | — |
| 2/9 — Erro de Input | Quiz fácil | +15 | 0 | erro → -1 ❤️ |
| 3/9 — Persona | Quiz médio | +20 | 0 | erro → -1 ❤️ |
| 4/9 — Engenharia de Contexto | Quiz hard | +25 | 0 | erro → -1 ❤️ |
| 5/9 — UAU 1 (Visual/Escrita) | Interativo | +10 | n/a | — |
| 6/9 — UAU 2 (Chips V5) | Interativo | +15 | n/a | — |
| 7/9 — UAU 3 (Critique Loop) | Quiz hard | +10 | 0 | erro → -1 ❤️ |
| 8/9 — MISTAKE REVIEW | Retry erros | 0 Domínio | n/a | **recupera ❤️ + ⚡ Sparks** |
| 9/9 — Antecipação | Leitura | 0 | n/a | — |
| **Total Domínio** | | **100** | | |

### Combo de acertos seguidos (Sub-telas 2+3+4+7)

| Acertos consecutivos | Bônus |
|---------------------|-------|
| 2 seguidos | +3 |
| 3 seguidos | +5 cumulativo |
| 4 seguidos | +10 cumulativo (total +18) |

**Cap real:** Domínio nunca passa de 100 (mesmo com combos). UI e DB respeitam o limite.

**Combo NÃO é retroativo via Mistake Review.** Mistake Review é economia separada (Vidas + Sparks). Domínio reflete só o primeiro tento.

### Mensagem final por faixa de Domínio (mostrada na Tela 11)

| Faixa | Emoji | Mensagem |
|-------|-------|----------|
| 30-49 | 🌱 | **"Onde você tá: começando. Onde você vai chegar: depende do quanto vai querer. O YesLiv tá feito pra esse caminho."** |
| 50-69 | 🌿 | "Você tem base. Vamos afiar." |
| 70-89 | 🌳 | "Top. Você já saca de IA. Vamos pro próximo nível." |
| 90-100 | 🏔️ | "99% dos usuários de IA nunca chega aqui. Bem-vindo ao topo." |

---

## Sub-tela 1/9 — Filtro de Interesse

```
[Header: Domínio IA: 5 | ❤️❤️❤️❤️❤️]

"Imagine que a IA pode resolver algo pra
 você em 5 segundos. O que quer criar agora?"

┌────────────────────────────────────────┐
│ 🎨  Uma imagem épica                    │
│     que impressiona qualquer um         │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ ✍️  Um texto impecável                  │
│     que engaja e vende                  │
└────────────────────────────────────────┘
```

**Comportamento:**
- Salva `filter_interest` = 'visual' | 'writing'
- Domínio: +5
- Avança automático após 500ms
- Define ramificação na Sub-tela 5

---

## Sub-tela 2/9 — Erro de Input (Quiz fácil)

```
[Header: Domínio IA: 10 | ❤️❤️❤️❤️❤️]

"Você abre o ChatGPT e digita:
 'Crie estratégia pro meu projeto'.
 O que mais provavelmente acontece?"

❌ A) Cria um plano completo e pronto pra executar
✅ B) Gera texto genérico que serve pra qualquer
      projeto e na prática não serve pra nenhum
❌ C) Pergunta de volta pedindo mais contexto
      antes de responder
```

**Feedback contextual:**
- ✅ B: *"Exato. Sem contexto, IA dá resposta genérica. É a primeira armadilha."*
- ❌ A: *"Quase. IA não cria plano completo sem contexto — ela inventa um genérico."*
- ❌ C: *"Boa hipótese, mas IA NÃO pergunta de volta sozinha. Ela tenta responder com o que tem."*

**Pontuação:** acerto = +15. Erro = 0. **Vidas:** erro → -1 ❤️.

---

## Sub-tela 3/9 — Persona (Quiz médio)

```
[Header: Domínio IA: 25 se acertou | ❤️ X/5]

"Pra IA parar de responder como robô chato,
 qual comando ativa a melhor Persona?"

❌ A) "Seja inteligente e detalhado nas respostas"
✅ B) "Aja como um especialista experiente da área
       que estou perguntando, com 15 anos de prática"
❌ C) "Responda como um especialista da área"
```

**Feedback:**
- ✅ B: *"Isso. Especificidade + tempo de experiência = IA muda o tom completamente."*
- ❌ A/C: *"Quase. Faltou especificidade — 'experiente' e '15 anos de prática' fazem a diferença."*

**Pontuação:** +20 acerto. **Combo:** +3 se 2 seguidas. **Vidas:** erro → -1 ❤️.

---

## Sub-tela 4/9 — Engenharia de Contexto (Quiz hard) — Viagem Lisboa

```
[Header: Domínio IA: 45 com combo | ❤️ X/5]

"Você quer planejar viagem pra Lisboa.
 Qual prompt entrega plano REAL?"

❌ A) "Me dá um roteiro de viagem pra Lisboa de 7 dias"

✅ B) "Aja como guia de viagem especialista em Lisboa.
       Contexto: 7 dias, casal 45/42, €5.000, gastronomia
       e história. Entregue: roteiro dia a dia, restaurantes
       com faixa de preço, atrações com tempo, bairros
       hospedagem (prós/contras), dicas off-tourist, plano B
       se chover."
```

**Feedback:**
- ✅ B: *"Isso é Engenharia de Contexto. O B faz a IA entregar roteiro que VOCÊ pode executar amanhã."*
- ❌ A: *"Quase. Mesma informação na cabeça, mas sem estrutura. Diferença brutal no output."*

**Pontuação:** +25 acerto. **Combo:** +5 se 3 seguidas. **Vidas:** erro → -1 ❤️.

---

## Sub-tela 5/9 — UAU 1 (PERSONALIZADO)

### Se escolheu 🎨 Visual:

Aluno escolhe Estilo (Realista/Cartoon/Foto) + Tema (Paisagem/Futurista/Natureza). Clica "Gerar com IA". 2s spinner. Imagem mockup aparece com fade.

Texto pós: *"Pronto. Isso foi feito com IA em 2 segundos."*

### Se escolheu ✍️ Escrita:

Email "antes" mostrado (casual). Clica "Reescrever com IA". 3s animação typewriter. Email "depois" aparece (profissional).

Texto pós: *"Pronto. Email casual → email profissional em 3 segundos."*

**Pontuação:** +10 (sempre soma). **Vidas:** não afeta.

---

## Sub-tela 6/9 — UAU 2 — CHIPS V5 PROMPT BUILDER

**A grande estrela. Aluno BUILDA o prompt na mão.**

```
[Header: Domínio IA: variável | ❤️ X/5]

"Hora de construir seu primeiro prompt PRO.
 Toque em cada lacuna e escolha um chip."

┌────────────────────────────────────────────┐
│                                            │
│  Quero um  [_____]  para  [_____]          │
│                                            │
│  com tom  [_____],  pra  [_____]           │
│                                            │
└────────────────────────────────────────────┘
```

### Categorias (cada lacuna abre keyboard de chips)

**1 — VERBO:** 📊 Plano | 📝 Resumo | 💡 Análise | 🎯 Roteiro | ⚡ Estratégia | 📈 Relatório

**2 — PARA QUEM:** 👤 Cliente | 🏠 Família | 🎓 Curso/estudo | 🪞 Mim mesmo | 👥 Time | 🌍 Público

**3 — TOM:** 🎩 Profissional | 😊 Amigável | ⚡ Direto | 🚀 Empolgado | 🧘 Calmo | 🎯 Decisivo

**4 — INTENÇÃO:** 💰 Vender mais | 🎯 Convencer | 🧠 Informar | 💪 Inspirar ação | ⚖️ Ajudar a decidir | 🌟 Inovar

### Resultado final (após preencher as 4)

```
╔════════════════════════════════════════════╗
║  🎉 SEU PRIMEIRO PROMPT PROFISSIONAL      ║
║                                            ║
║  "Quero um Plano para Mim mesmo, com tom  ║
║   Decisivo, pra Inspirar minha ação."     ║
║                                            ║
║  ✨ Sabe o que você acabou de fazer?      ║
║                                            ║
║  Você usou a fórmula que profissional     ║
║  de IA cobra R$ 500/h pra ensinar:        ║
║                                            ║
║  [VERBO] + [PARA QUEM] + [TOM] + [INTENÇÃO]║
╚════════════════════════════════════════════╝

[ ▶ Copiar prompt ]
[ Continuar ]
```

**Comportamento:**
- Reutilizar `GuidedPlayground.tsx` da V5 (3 → 4 lacunas)
- Bounce ao escolher chip (100ms)
- Selo "PRO" quando completo
- Botão "Copiar prompt" copia pra clipboard
- Salva 5 campos em `onboarding_v2_answers`
- **Domínio:** +15 (sempre soma)

---

## Sub-tela 7/9 — UAU 3 — Critique Loop (Quiz hard)

```
[Header: Domínio IA: variável | ❤️ X/5]

"Você usou IA. A resposta veio mediana.
 Como pedir pra ela MELHORAR a própria
 resposta?"

❌ A) "Reescreve melhor"
❌ B) "Tenta de novo"
✅ C) "Identifique os 3 pontos mais fracos
       da resposta acima. Reescreva sem
       esses pontos. Explica o que mudou."
```

**Após escolher C:** animação antes/depois (texto rascado → texto novo brilhando).

**Mensagem pós:**
```
🚀 CRITIQUE LOOP ativado.

   Você acabou de aprender uma técnica que
   99% dos usuários de IA nunca ouviu falar.

   Você sai daqui sabendo o que profissional
   de IA cobra R$ 5 mil pra ensinar.
```

**Pontuação:** +10 acerto. **Combo:** +10 se 4 seguidas. **Vidas:** erro → -1 ❤️.

---

## Sub-tela 8/9 — MISTAKE REVIEW

**Mecânica Duolingo Mistakes Review aplicada. Ensina Vidas + Sparks em contexto.**

### Caso A — Aluno errou pelo menos 1 pergunta

```
[Header: Domínio IA: variável | ❤️❤️❤️🤍🤍]

┌─────────────────────────────────────────────────────┐
│  ❤️❤️❤️🤍🤍                                            │
│  Você perdeu 2 Vidas durante o desafio.             │
│                                                      │
│  💡 Quer recuperar?                                  │
│                                                      │
│  Refaça as 2 questões que errou.                    │
│  Se acertar → recupera as Vidas + ganha Sparks.     │
│                                                      │
│  [BORA REVISAR]                                     │
└─────────────────────────────────────────────────────┘
```

**Fluxo de retry (uma pergunta de cada vez):**

```
┌─────────────────────────────────────────────────────┐
│  Revisão 1/2                                         │
│                                                      │
│  Você errou esta:                                   │
│                                                      │
│  "Você abre o ChatGPT e digita:                     │
│   'Crie estratégia pro meu projeto'.                │
│   O que mais provavelmente acontece?"               │
│                                                      │
│  💡 Hint: o erro foi achar que IA adivinha contexto. │
│                                                      │
│  A) Cria um plano completo                          │
│  B) Gera texto genérico                             │
│  C) Pergunta de volta                               │
└─────────────────────────────────────────────────────┘
```

**Comportamento (explícito):**
- Pergunta aparece igual à original (mesmas 3 opções)
- Hint suave referenciando o erro
- Acertou → ❤️ recuperada (anima 🤍 → ❤️) + feedback positivo + **avança automático pra próxima pergunta a revisar**
- Errou de novo → ❤️ NÃO recuperada, mensagem: *"Tudo bem. Esse conceito a gente revisa na primeira aula."* + **avança automático pra próxima pergunta a revisar**
- Após última pergunta → vai pra tela de Reward

**Tela de Reward (Caso A):**

```
┌─────────────────────────────────────────────────────┐
│  🎉 Revisão completa!                               │
│                                                      │
│  ❤️❤️❤️❤️❤️  +2 Vidas recuperadas                     │
│  ⚡ +5 Sparks pelo esforço                          │
│                                                      │
│  💡 O que é isso?                                   │
│                                                      │
│  ❤️ Vidas são suas tentativas. Quando acaba,        │
│     espera 3h ou usa Sparks pra repor na hora.      │
│                                                      │
│  ⚡ Sparks você troca na Loja por bônus             │
│     (XP boost, ferramentas extras, personalização). │
│                                                      │
│  [CONTINUAR]                                        │
└─────────────────────────────────────────────────────┘
```

### Caso B — Aluno acertou TUDO (0 erros)

```
┌─────────────────────────────────────────────────────┐
│  🏆 Você não errou nenhuma!                         │
│                                                      │
│  ❤️❤️❤️❤️❤️  Vidas intactas                           │
│  ⚡ +10 Sparks Bônus de Mestre                      │
│                                                      │
│  💡 Sparks você troca na Loja por bônus             │
│     (XP boost, ferramentas extras, personalização). │
│                                                      │
│  [CONTINUAR]                                        │
└─────────────────────────────────────────────────────┘
```

**Por que Bônus de Mestre é maior (+10 vs +5):** quem acertou tudo merece reconhecimento extra. Quem revisa ganha menos Sparks mas recupera Vidas — equilibra economia sem punir.

**Salva:**
- `mistake_review_attempted` (boolean)
- `mistake_review_recovered` (int, vidas recuperadas)
- `mistake_review_sparks` (int, sparks ganhos)
- Atualiza `users.hearts_current` e `users.sparks_balance`

**Domínio:** 0 (não soma — Domínio reflete primeiro tento).

---

## Sub-tela 9/9 — ANTECIPAÇÃO

**Sub-tela propositalmente silenciosa.** Sem barra de Domínio mudando, sem Hearts mudando. Só leitura emocional.

```
[Header: Domínio IA: ~95 | ❤️ X/5 — sem animação]

⏳ Pause aqui por 5 segundos.

Imagina você daqui 28 dias.

Quando alguém perguntar:
"Você sabe usar IA?"

Você não vai ter que mentir,
não vai ter que se esquivar,
não vai ter que sentir aquele aperto
de "ainda não...".

Você vai responder:

"Sei.
 E uso pra dominar meu trabalho,
 meus projetos, minha vida."

A diferença entre quem responde isso
e quem evita a pergunta...

começou aqui. Agora.

[ Continuar ]
```

**Comportamento:**
- Pausa de **1 segundo** + fade-in animado do CTA (não delay seco)
- Não tem quiz, só leitura emocional
- Pontuação: 0
- Headers do Domínio e Hearts ficam visíveis mas sem animação (silêncio visual)

### Critérios de aceite — FASE 2

- [ ] `<DominioBar />` anima corretamente em todas as sub-telas
- [ ] `<HeartsBar />` visível desde 1/9, anima erros (shake+fade) e recovery (fade-in)
- [ ] Combo toast aparece quando 2+ acertos seguidos
- [ ] Sub-tela 5 ramifica corretamente por filter_interest
- [ ] Sub-tela 6 (Chips V5) permite construir prompt completo, mostra resultado com selo PRO
- [ ] Mistake Review pula retry se 0 erros, executa retry se 1+ erros
- [ ] Mistake Review avança automático após cada retry (acerto OU erro)
- [ ] Vidas recuperadas atualizam `users.hearts_current` E `users.hearts_last_lost_at`
- [ ] Sparks ganhos atualizam `users.sparks_balance`
- [ ] Sub-tela 9 tem pausa de 1s + fade-in animado (não delay seco)
- [ ] Domínio cap real em 100 (combo não estoura)

---

# 🎁 FASE 3 — Reveal + Cadastro (Telas 11-13)

**Objetivo:** consolidar recompensas + pedir notification (gesture-based) + capturar cadastro (com persistência).

**Tempo estimado:** 5h

---

## Tela 11 — Reveal Orgânico

```
[Vídeo Liv comemorando — liv-clap.mp4]

✨ Você acabou de provar que sabe usar IA.

Seu Domínio IA: XX 🏔️ (faixa correspondente)

[Mensagem da faixa — ver tabela]

🎯 RECOMPENSAS:
   ⚡ +20 XP iniciais
   ✨ +X Sparks (do Mistake Review)
   ❤️ X/5 Vidas
   🔥 Sequência: 1 dia
   🎖️ Patente: Novato Nv 1

[Mensagem condicional baseada em path_choice]

Progress bar: 89%

[ Continuar ]
```

**Mensagem condicional por path_choice:**
- `'zero'`: *"Você escolheu começar do zero. Sua trilha começa na Aula 1 (Fundamentos da IA)."*
- `'placement'`: *"Baseado no seu Domínio IA, vamos te recomendar por onde começar."*

**Comportamento:**
- Lê `ai_dominio_score` e mostra faixa correspondente
- Lê `mistake_review_sparks` e mostra
- Lê `hearts_current` e mostra
- Cria XP inicial (+20) em `users.xp_total`
- Cria streak (1) em `users.streak_days`
- Cria Patente inicial (Novato Nv 1) em `users.patente_level`

---

## Tela 12 — Notification Primer

| Elemento | Conteúdo |
|----------|----------|
| Vídeo Kling AI | `liv-point-up.mp4` (LIV apontando pra cima) |
| Balão LIV | "Vou te lembrar de praticar até virar hábito." |
| Progress bar | 95% |
| CTA primário | **[PERMITIR LEMBRETES]** (no click → dispara `Notification.requestPermission()`) |
| CTA secundário | **[AGORA NÃO]** |
| Microcopy | "Você pode mudar isso depois nas configurações." |

**Comportamento técnico (CRÍTICO):**
- Prompt nativo do navegador SÓ dispara no click do botão (gesture-based)
- Nada de `useEffect` ou auto-trigger
- iOS Safari só aceita assim
- Após resposta do prompt nativo (Permitir/Negar), botão CONTINUAR aparece

**Dado:** `users.notif_permission` ('granted' | 'denied' | 'default').

---

## Tela 13 — Cadastro (deferred)

| Elemento | Conteúdo |
|----------|----------|
| Centro | `liv-point-up-save.mp4` |
| Headline | **"Salve o que você fez."** |
| Subtexto | **"Pra continuar de onde parou, em qualquer device."** |
| Progress bar | 100% |
| CTA primário | CRIAR UM PERFIL (botão azul forte) |
| CTA secundário | DEPOIS (botão branco/fraco) |
| Form (após CRIAR) | Email + Senha + ☐ Manter conectado (default marcado) + [Login Google] |

**Lógica:**
- **CRIAR UM PERFIL** → form. Ao confirmar:
  - Cria row em `users`
  - UPDATE onboarding_v2_answers SET user_id = users.id WHERE session_id = X
  - Limpa sessionStorage
  - Vai pra home autenticado
- **DEPOIS** →
  - Gera UUID v4 como `deferred_session_token`
  - UPDATE onboarding_v2_answers SET deferred_session_token = X, deferred_expires_at = NOW + 7 days
  - Salva token em cookie `deferred_session_token` (TTL 7 dias, HttpOnly, Secure, SameSite=Lax)
  - Vai pra home como visitante
  - Se aluno voltar dentro de 7 dias com cookie → mostra banner: *"Você fez o desafio. Quer salvar seu progresso?"*

### Critérios de aceite — FASE 3

- [ ] Tela 11 mostra Domínio + recompensas + Patente baseadas em `onboarding_v2_answers` + path_choice
- [ ] Tela 12 dispara prompt nativo SÓ no click (gesture-based)
- [ ] Tela 12 funciona em iOS Safari (testar em device real)
- [ ] Tela 13 form valida email + senha mínima (8 chars)
- [ ] Login Google funcional (OAuth)
- [ ] Ao cadastrar, sessionStorage migra pra DB e limpa
- [ ] DEPOIS salva cookie 7 dias e persiste deferred_session_token
- [ ] Voltar dentro de 7 dias com cookie mostra banner de recuperação

---

# 🎨 FASE 4 — Polish e testes

**Objetivo:** detalhes finais que fazem o aluno sentir profissional.

**Tempo estimado:** 3h

### Tarefas

1. **Sons (gesture-based, try/catch mute):**
   - Integrar correct/wrong/chip-select/heart-lose/heart-gain/spark-gain
   - Web Audio API on-click, NUNCA autoplay
   - Fallback `try { audio.play() } catch (e) { /* silent */ }`
2. **Animações finas:**
   - Progress bar transição suave 300ms
   - LIV bubble fade-in 200ms
   - Cards de escolha hover lift
   - Chip select bounce 100ms
   - Domínio bar glow no 90+
   - Hearts shake+fade 300ms
3. **Smoke test end-to-end:**
   - Rodar fluxo completo 3 vezes com escolhas diferentes
   - Verificar dados no DB após cada rodada
   - Testar Mistake Review com 0, 2, 4 erros
   - Testar Hook com torcer/garantir
   - Testar deferred (cookie 7 dias)
4. **Acessibilidade básica:**
   - Tab navigation entre cards
   - Aria-labels nos botões
   - Contraste mínimo 4.5:1
5. **Mobile-first responsivo:**
   - Testar em viewport 375px (iPhone SE)
   - Testar em viewport 768px (iPad)
   - Testar em viewport 1280px+ (Desktop)
6. **Compat vídeos:**
   - Verificar MP4 H.264 baseline funciona em todos navegadores
   - Adicionar `<source type="video/webm">` como fallback

### Critérios de aceite — FASE 4

- [ ] Sons funcionam (ou silenciam graciosamente)
- [ ] Animações não travam em mobile
- [ ] Fluxo completo roda em 5-7 min
- [ ] DB tem todos os dados esperados após cadastro
- [ ] Funciona em iPhone Safari + Chrome Android + Desktop Chrome/Firefox

---

## 🧪 Cenários extremos

### Aluno acerta tudo + combo 4 seguidas

```
T1 Filtro:         +5
T2 Erro Input:    +15 (acertou)
T3 Persona:       +20 (acertou) → combo +3
T4 Contexto:      +25 (acertou) → combo +5
T5 UAU 1:         +10
T6 UAU 2 Chips:   +15
T7 Critique:      +10 (acertou) → combo +10
T8 Mistake Review: skip → +10 Sparks Bônus de Mestre
T9 Antecipação:    0
Total Domínio: 100 + 18 bônus = cap em 100 (não 118)
Vidas: ❤️❤️❤️❤️❤️
Sparks: +10
Mensagem: 🏔️ "99% dos usuários nunca chega aqui."
```

### Aluno erra TODAS as perguntas (T2, T3, T4, T7)

```
T1: +5  T2: 0  T3: 0  T4: 0  T5: +10  T6: +15  T7: 0
T8 Mistake Review: retry 4 perguntas
  → acerta todas: +4 ❤️ + +5 Sparks
  → acerta 2: +2 ❤️ + +5 Sparks
  → erra todas: 0 ❤️ + +5 Sparks (não pune duplo)
T9 Antecipação: 0
Total Domínio: 30
Vidas: variável (0-5)
Sparks: +5
Mensagem: 🌱 "Onde você tá: começando. Onde você vai chegar: depende do quanto vai querer. O YesLiv tá feito pra esse caminho."
```

### Aluno errou 2 das 4 perguntas

```
T2 erro (-1 ❤️), T3 acerto (+20), T4 acerto (+25), T7 erro (-1 ❤️)
Domínio antes do Review: 5+0+20+25+10+15+0 = 75
T8 Mistake Review: retry 2 perguntas
  → acertou as 2 no retry: +2 ❤️ + +5 Sparks
T9 Antecipação: 0
Total Domínio: 75
Vidas finais: ❤️❤️❤️❤️❤️
Sparks: +5
Mensagem: 🌳 "Top. Você já saca de IA."
```

### Aluno escolhe DEPOIS na Tela 13 e volta em 5 dias

```
Tela 13: DEPOIS
  → gera deferred_session_token (UUID)
  → salva cookie 7 dias
  → onboarding_v2_answers atualizado
  → vai pra home como visitante

5 dias depois:
  → aluno volta no mesmo device
  → cookie ainda válido
  → banner: "Você fez o desafio. Quer salvar seu progresso?"
  → [SALVAR] → form de cadastro pre-vinculado ao token
  → [DESCARTAR] → limpa cookie + onboarding_v2_answers
```

---

## 🚫 O que NÃO fazer

- ❌ NÃO chamar API real (custo zero é regra dura)
- ❌ NÃO desconto de pontos por erro (só não ganha)
- ❌ NÃO usar "QI" — usar "Domínio IA"
- ❌ NÃO usar "Cristais" — usar "Sparks"
- ❌ NÃO usar "Hearts" — usar "Vidas"
- ❌ NÃO usar "jornada" — usar "caminho"
- ❌ NÃO suavizar Critique Loop (linguagem forte é intencional)
- ❌ NÃO voltar pra SWOT como UAU 2 — chips V5 é decisão final
- ❌ NÃO adicionar Hook Emocional no Desafio — Hook fica no wizard (Tela 4)
- ❌ NÃO esquecer da Barra de Domínio IA
- ❌ NÃO esquecer das Vidas no header do Desafio
- ❌ NÃO pular Mistake Review pra Caso B — mostrar reward simplificado
- ❌ NÃO bloquear aluno se chegar a 0 Vidas no Desafio (só pedagógico)
- ❌ NÃO somar pontos de Domínio no Mistake Review
- ❌ NÃO retroativar combo via Mistake Review
- ❌ NÃO pedir cadastro antes da Tela 13
- ❌ NÃO disparar `Notification.requestPermission()` sem gesture (iOS bloqueia)
- ❌ NÃO usar "trabalho" como escopo único (curso é trabalho + projetos + vida)
- ❌ NÃO usar "Vantagem injusta" ou outras frases de coach gringo
- ❌ NÃO mostrar Notification Primer antes do Reveal
- ❌ NÃO usar "Bora" mais que 2 vezes no fluxo todo
- ❌ NÃO citar "91%" sem comment de fonte (Inforchannel 2025)
- ❌ NÃO atribuir frase do Hook a "The Economist" — fonte é Dario Amodei/Anthropic
- ❌ NÃO comparar pessoas com animais (cavalo/etc) — dehumaniza
- ❌ NÃO usar `user_id NOT NULL` em onboarding_v2_answers (deferred)
- ❌ NÃO assumir só leigo (adultos profissionais, linguagem respeitosa)

---

## ⏱️ Plano total de horas

| Fase | Conteúdo | Horas |
|------|----------|-------|
| **0** | Infraestrutura (schema + componentes base + DominioBar + HeartsBar + SessionManager + roteamento) | 6h |
| **1** | Wizard de Coleta (Telas 1-9) com Hook reescrito + Atribuição cedo | 9h |
| **2** | Desafio (Tela 10, 9 sub-telas, incluindo Mistake Review) | 14h |
| **3** | Reveal + Notification gesture-based + Cadastro deferred 7 dias | 5h |
| **4** | Polish + sons + animações + smoke tests + responsivo + compat vídeos | 3h |
| **TOTAL** | | **37 horas** |

### Distribuição sugerida

- **Sprint 1 (1 semana):** FASE 0 + FASE 1 = 15h
- **Sprint 2 (1 semana):** FASE 2 = 14h
- **Sprint 3 (3-4 dias):** FASE 3 + FASE 4 = 8h

---

## 📋 Checklist de aprovação final

Antes de mandar pro Claude Code implementar, confirmar:

- [ ] Schema do banco aprovado pelo time
- [ ] Vídeos da LIV definidos (Kling AI ou placeholder)
- [ ] 9 imagens UAU 1 Visual produzidas
- [ ] Endpoint OAuth Google configurado (pra Tela 13)
- [ ] Variáveis de ambiente (`DATABASE_URL`, `GOOGLE_OAUTH_*`)
- [ ] Decisão sobre versão americana (Amodei + Claude funciona globalmente)
- [ ] Cookie strategy aprovado (HttpOnly + 7 dias)

---

## 📚 Fontes citadas

- **Hook (Tela 4):** Dario Amodei, CEO da Anthropic, 2026 — "AI could wipe out half of all entry-level white-collar jobs"
  - [CNBC: AI is already taking white-collar jobs](https://www.cnbc.com/2025/10/22/ai-taking-white-collar-jobs-economists-warn-much-more-in-the-tank.html)
- **Stat "91%":** Inforchannel 2025 — "apenas 9% dos departamentos financeiros usam IA estruturalmente"
- **Deferred account creation:** Appcues, UserGuiding, Mobbin — padrão validado Duolingo
- **Notification gesture-based:** [Apple — Web Push Notifications Best Practices](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
- **Mistakes Review:** padrão Duolingo confirmado em Duolingo Fandom + Appcues

---

**Fim do documento.**

Próximo passo: Claude Code começa pela FASE 0.
