# Plano AILIV — Gamificação V2 (Spec Consolidada)

> Documento master do projeto de gamificação da AI Academy.
> Consolida: 10 gaps identificados + 4 decisões técnicas fechadas + escopo MVP enxuto + sequenciamento por fases + schema do banco + decisões de LIV + migração V5→V8.
>
> **Versão:** 2.0 (revisada — maio/2026 — auditoria técnica aplicada)
> **Status:** spec estratégica + técnica fechada. Pronto pra Claude Code começar implementação.
> **Anexo técnico:** `gaps-implementacao-tecnica.md`

---

## 1. Resumo Executivo

A AI Academy é uma plataforma de ensino de IA pra profissionais brasileiros 38+. Hoje tem aulas no formato V8 (texto + áudio narrado + exercícios interativos + IA avaliando prompt). Falta o que faz Duolingo viralizar: sistema de gamificação coerente que prende o aluno e cria loop de retorno diário.

Este plano aplica a **fórmula Duolingo** ao público adulto profissional brasileiro — adaptando o que funciona pra adolescente (streak agressivo, hearts punitivos, ligas competitivas) pra um público que precisa de tratamento maduro mas com a mesma força de engajamento.

**Stack:** React + Supabase (Postgres + Edge Functions Deno + RPC) + TypeScript. Migração em curso do Lovable pro Claude Code.

**MVP:** **~116 horas** de execução, **3-4 semanas** de prazo (com buffer realista de 20% = 140h). Cobre os 10 gaps críticos identificados, com Ligas adiadas pro pós-MVP e LIV (mascote) já resolvida em paralelo.

**Princípio fundador:** "O que funciona no Duolingo só funciona se for adaptado pro tom adulto. Hearts existe, mas tem 'practice to earn'. Streak existe, mas com Streak Freeze. Competição existe, mas adiada até ter massa crítica." Nada infantil, nada cobrador, nada que pareça mascote de TV.

---

## 2. Visão Estratégica

### Público-alvo

- Profissionais brasileiros 38+
- Sem background técnico em IA
- Excel como principal ferramenta de BI
- Buscam aplicar IA no trabalho — não estudar IA por hobby
- Tempo escasso, intolerância a fricção, querem ser tratados como adultos
- Pagam por valor concreto, não por entretenimento

### Posicionamento

**Não é mais um app de cursos.** É uma plataforma de **prática supervisionada com IA**, onde o aluno aprende fazendo + recebe feedback contínuo da LIV (assistente virtual) + tem progresso visível através de mecânicas Duolingo-style adultas.

### Hipótese principal

Adultos profissionais respondem ao mesmo loop de dopamina que adolescentes — XP, streak, conquistas — desde que o tom da experiência seja maduro. O que mata gamificação pra 38+ não é a mecânica em si, é **a estética infantil e a punição agressiva**. Tirando esses dois fatores, o resto da fórmula Duolingo funciona.

---

## 3. Os 10 Gaps Identificados (com decisões)

Quando entrei no plano original (Sessão 2 — abril/2026), identifiquei 10 gaps críticos em relação ao modelo Duolingo. Todos foram aceitos pelo Fernando. Aqui está cada um com a decisão tomada:

| # | Gap | Decisão tomada | Implementação |
|---|-----|----------------|---------------|
| **G1** | **Daily Goal** (meta diária de XP) | 4 níveis (10/20/30/50 XP), default 20, cooldown 7d, sem teto de excesso | Detalhado no Item 2 |
| **G2** | **MAIA → LIV mascote real** | ✅ Resolvido — LIV FAB persistente + Vector + Foto + Symbol + vídeos Kling AI | Componentes `LIVSymbol.tsx` e `LIVMicrocopyBubble.tsx` já entregues |
| **G3** | **Path visual da trilha** | Bloqueio linear, Boss especial, Ouro = ≥95% + todos acertos | Detalhado no Item 2 |
| **G4** | **Crowns/Maestria** | ✅ 2 níveis (Bronze + Ouro), não 3. Prata vai pra V1.1 | Integrado ao G3 no Item 2 |
| **G5** | **Combo dentro da lição** | Reseta por lição. 3=+2 / 5=+5 / 10=+10+5coins. Trackear best_combo. | Detalhado no Item 2 |
| **G6** | **Practice to earn hearts** | ✅ Obrigatório com Hearts (evita churn). 5 exercícios sorteados de aulas completas. | Implementado junto com Fase 3 (Hearts System) |
| **G7** | **Notificações com voz da LIV** | 6 templates iniciais. Push após 1º dia válido. Quiet 22-7h. Inativo 1×/3d. | Detalhado no Item 2 |
| **G8** | **Onboarding gamificado** | 7 telas, ~90s. Mini-experiência IA com prompt pré-preenchido. Fluxo obrigatório. | Detalhado no Item 2 |
| **G9** | **Friend Quest** | ✅ 100c+100c = 200 cada lado. Limite 20/mês. WhatsApp+copy+nativo. ENTRA no MVP. | Detalhado no Item 2 |
| **G10** | **XP Boost com duração** | 150c / 15min / 2× XP (não coins). Renova (não acumula). | Detalhado no Item 2 |

---

## 4. As 4 Decisões Técnicas Críticas (fechadas)

### Decisão 1 — Hearts caem em quiz também
**Resultado:** **Todos os tipos de exercício** consomem heart se o aluno errar — múltipla escolha, quiz, flashcard, monte-o-prompt, reescrita.
**Por quê:** Senão hearts vira mecânica de mentirinha. Adulto sacaria em 1 dia que só múltipla escolha consome e ficaria sempre safe. Como temos "practice to earn hearts" (G6), o adulto não fica travado.

### Decisão 2 — API Playground: Gemini Flash (mantém)
**Resultado:** Mantém Gemini 2.5 Flash no playground scoring. Conserta só o Bug B1 (não estava gravando o score no banco). NÃO migra pra Claude.
**Por quê:** Gemini Flash custa ~10× menos que Claude Haiku. Em escala, a diferença vira centenas de dólares/mês.

### Decisão 3 — Campo `total_points` (legado): MATA
**Resultado:** **Apaga `total_points` da tabela `users`.** Refatora a página de Leaderboard pra ler `power_score`. Sistema único: `power_score` vira a fonte de verdade.
**Por quê:** A página de Leaderboard atual vai virar "Ranking Geral" do sistema novo de Ligas (pós-MVP) de qualquer jeito. 3h de refactor hoje vs 10h+ de dívida futura.

### Decisão 4 — Plano Ultra cancelado: igual Duolingo
**Resultado:** Mantém Ultra ativo **até o fim do período pago**. Quando o período acaba, **restaura hearts pra 5/5**. Mesmo padrão do Duolingo Super.
**Por quê:** Goodwill > squeeze de receita marginal. Adulto 38+ vira churn ativo se sente punido.

---

## 5. Decisões de Auditoria (maio/2026)

Estas decisões foram tomadas durante a auditoria técnica dos 2 docs e fecham buracos de spec antes da implementação.

### Decisão Aud-1 — Padrão técnico
- **ID type:** UUID em TODAS as tabelas (compatível com `auth.users.id` do Supabase)
- **RLS:** habilitado em TODAS as tabelas com policy padrão `auth.uid() = user_id` pra dados de aluno; tabelas de definição (templates, achievements) ficam com `SELECT` público
- **Naming convention:** Claude Code segue o padrão atual do banco (mistura snake_case inglês com algumas tabelas em PT como `trilhas`)
- **Migrations:** vão na pasta `supabase/migrations/` no padrão Supabase. Cada migration tem nome timestamp (ex: `20260520_g1_daily_goal.sql`)

### Decisão Aud-2 — Fórmula do `power_score`
**Cumulativo eterno**, nunca decresce:

```
power_score = SUM(daily_progress.xp_earned across all days)
            + SUM(achievement_definitions.xp_reward where unlocked)
            + bônus de streak milestone (+50 em 7d, +200 em 30d, +500 em 100d)
```

Atualizado via trigger no banco a cada update de `daily_progress.xp_earned`.

### Decisão Aud-3 — Patentes
5 níveis baseados em `power_score`:

| Patente | Faixa power_score |
|---------|-------------------|
| Iniciante | 0 — 99 |
| Operador | 100 — 499 |
| Praticante | 500 — 1.499 |
| Estrategista | 1.500 — 4.999 |
| Mestre | 5.000+ |

### Decisão Aud-4 — Streak
- **Avança SÓ** quando aluno bate `daily_goal` do dia (não basta abrir o app)
- **Gap de 1+ dia:** consome Streak Freeze se tiver disponível na loja; senão reseta `current_streak = 1`
- **Schema canônico:** ver `user_streaks` no schema unificado abaixo

### Decisão Aud-5 — Timezone
- Campo novo `users.timezone TEXT DEFAULT 'America/Sao_Paulo'`
- Detectado automaticamente no primeiro acesso via `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Crons rodam de hora em hora em UTC, mas avaliam o horário LOCAL de cada user via `AT TIME ZONE`

### Decisão Aud-6 — Naming do projeto
**"AI Academy"** em strings de UI (nome público).
**"AILIV"** em código interno, docs e branding técnico.

---

## 6. MVP Enxuto — Escopo final

### O que ENTRA no MVP (~116h)

| Fase / Gap | Item | Horas |
|------|------|-------|
| Fase 0 | Reparos cirúrgicos (3 bugs: B1, B2, B3) | 4h |
| Fase 1 | Consolidação da base (eliminar `total_points`, achievements persistidos) | 6h |
| **G1** | Daily Goal | 7h |
| **G3** | Path Visual (inclui G4 Crowns Bronze+Ouro) | 11h |
| Fase 2 | Loja enxuta (4 itens: Streak Freeze, Heart Refill, XP Boost, Prompt Premium) | 10h |
| Fase 3 | Hearts System + G6 practice to earn | 14h |
| **G8** | Onboarding gamificado | 9h |
| **G5** | Combo dentro da lição | 5h |
| **G7** | Notificações da LIV | 11h |
| **G10** | XP Boost com timer | 7h |
| **G9** | Friend Quest básico | 8h |
| Fase 5 | Insights do Playground gamificados (Bug B1 + tier de recompensa) | 14h |
| Fase 6 | Achievements 2.0 (8 conquistas iniciais persistidas) | 10h |
| — | G2 LIV (já resolvido em paralelo) | — |
| **Total bruto** | | **~116h** |
| Com buffer 20% | | **~140h** |

**Prazo: 3-4 semanas full-time.**

### O que NÃO entra no MVP (vai pra V1.1 / V2)

| Item | Por quê adiado |
|------|----------------|
| **Ligas semanais** (Fase 4 original — 20h) | Precisa de massa crítica de usuários reais. Bots como solução parcial introduzem risco de quebrar trust. Aguarda 50+ alunos ativos. |
| **G4 Crowns Prata** (3º nível de maestria) | Lança com Bronze + Ouro apenas. Adiciona Prata em V1.1 se a maestria gerar engajamento. Reduz 33% de produção de conteúdo. |
| **G9 Friend Quest avançado** (quests duplas, badges colaborativos) | Lança convite básico (link único, 200 coins). Quests duplas vão pra V2. |
| **LIV Chat** (perguntar à LIV via Claude API) | Vai pra V2 quando ilustradora Lottie entregar a animação completa da LIV Vector. |
| **A/B test de tom de notificação** | V2. |
| **Personalização de microcopy por perfil** | V2. |
| **Streak Society avançado** (Streak Recovery, Streak Shield automático) | Lança com Streak básico + Streak Freeze. Recovery e Shield vão pra V1.1. |
| **Social completo** (seguir amigos, 1v1, gifts) | Vai pra V2. Adultos profissionais não pedem social como primeira coisa. |

---

## 7. Sequenciamento (3-4 semanas)

```
SEMANA 1 — Reparos + Base + Daily Goal + Path
├── Dia 1-2:  Fase 0 (3 bugs B1+B2+B3 corrigidos)                      4h
├── Dia 2-3:  Fase 1 (matar total_points, achievements base, streak)   6h
├── Dia 3-4:  G1 Daily Goal (banco + UI + lógica + power_score trigger) 7h
├── Dia 4-5:  G3 Path Visual (com G4 Crowns Bronze+Ouro)              11h
└── Saída: base limpa + meta diária + path navegável

SEMANA 2 — Loja + Hearts + Onboarding
├── Dia 6-7:  Fase 2 Loja enxuta (4 itens + tabelas + UI)              10h
├── Dia 7-9:  Fase 3 Hearts System + G6 practice to earn               14h
├── Dia 9-10: G8 Onboarding gamificado (7 telas + reveal)               9h
└── Saída: aluno entra novo, ganha XP, sente hearts e loja

SEMANA 3 — Combo + Notif + Boost + Friend Quest
├── Dia 11:    G5 Combo na lição                                        5h
├── Dia 11-12: G7 Notificações LIV (templates + crons + push)          11h
├── Dia 12-13: G10 XP Boost (loja + timer + multiplier)                 7h
├── Dia 13-14: G9 Friend Quest (link + recompensas + share)             8h
└── Saída: loop social + ativação por notificação funcionando

SEMANA 4 — Insights + Achievements + QA
├── Dia 15-16: Fase 5 Insights Playground (Bug B1 + tiers)             14h
├── Dia 16-18: Fase 6 Achievements 2.0 (8 conquistas iniciais)         10h
├── Dia 18-19: QA + polish + ajustes finais
└── Saída: MVP completo, testado, pronto pra lançar
```

**Buffer:** ~24h espalhadas pra retrabalho. Total realista: 4 semanas.

---

## 8. Schema do Banco — Visão Unificada

Visão geral. Schema completo com tipos, indexes, RLS e CHECK constraints está no Item 2 (`gaps-implementacao-tecnica.md`).

### Tabelas a CRIAR (novas)

| Tabela | Propósito | Origem |
|--------|-----------|--------|
| `daily_progress` | XP diário do usuário + status da meta | G1 |
| `user_streaks` | Streak atual + recorde + último dia ativo (se não existe ainda) | Streak System |
| `trilha_progress` | Cache de progresso por trilha (perf) | G3 |
| `liv_phrases` | Pool de 58 frases aprovadas da LIV | G7 |
| `liv_phrase_usage` | Log anti-repetição de frases por user | G7 |
| `notification_templates` | Templates das mensagens da LIV (push + in-app) | G7 |
| `notification_log` | Log de envios (anti-spam + analytics) | G7 |
| `user_notification_preferences` | Quiet hours + opt-in/out por categoria | G7 |
| `push_subscriptions` | Tokens Web Push API por user | G7 |
| `shop_items` | Itens da loja (Streak Freeze, Heart Refill, XP Boost, Prompt Premium) | Fase 2 |
| `user_shop_purchases` | Histórico de compras na loja | Fase 2 |
| `user_active_boosts` | Boosts ativos (anti-acúmulo) | G10 |
| `user_streak_freezes` | Streak Freezes disponíveis pra consumir | Fase 2 |
| `user_hearts_log` | Log de hearts ganhos/perdidos (auditoria) | Fase 3 |
| `practice_sessions` | Sessões de practice-to-earn-hearts | G6 |
| `achievement_definitions` | 8 conquistas iniciais + futuras (definições) | Fase 6 |
| `user_achievements_v2` | Conquistas desbloqueadas por user | Fase 6 |
| `referrals` | Tracking de convites do Friend Quest | G9 |

**Total: 18 tabelas novas.**

### Tabelas a ALTERAR

| Tabela | Campos novos | Origem |
|--------|--------------|--------|
| `users` | `daily_goal_xp`, `daily_goal_changed_at` | G1 |
| `users` | `hearts`, `hearts_last_regen` | Fase 3 |
| `users` | `best_combo` | G5 |
| `users` | `onboarding_completed_at`, `onboarding_step`, `profession`, `learning_objective` | G8 |
| `users` | `referral_code`, `referred_by_user_id` | G9 |
| `users` | `ultra_plan_expires_at` | Decisão 4 |
| `users` | `timezone` (default `'America/Sao_Paulo'`) | Decisão Aud-5 |
| `user_lessons` | `mastery_level`, `mastery_achieved_at` | G3 / G4 |
| `lessons` | `is_boss_lesson` (se não existir) | G3 |

**Total: 11 campos novos em `users`, 2 em `user_lessons`, 1 em `lessons`.**

### Tabelas a APAGAR

| Tabela / Campo | Razão |
|----------------|-------|
| `users.total_points` | Decisão técnica #3 — substituído por `power_score` cumulativo |

### Tabelas a manter como estão

| Tabela | Notas |
|--------|-------|
| `users` (incluindo `power_score`) | Mantém `power_score`, recebe trigger novo |
| `trilhas` | Mantém estrutura atual |
| `lessons` | Recebe campo novo `is_boss_lesson` |
| `user_lessons` | Recebe campos novos `mastery_level` + `mastery_achieved_at` |

---

## 9. LIV — Decisões Consolidadas

A LIV foi o gap G2 e consumiu boa parte do tempo de planejamento. Estado atual:

### Identidade visual em 3 camadas

| Camada | Como aparece | Uso |
|--------|--------------|-----|
| **LIV Foto** | Imagem fotorrealista atual + 7 expressões a gerar (Encorajando, Celebrando, etc) via Nano Banana/Flux | Momentos premium (5% das aparições): onboarding, "Aula completa", insight ouro, conquistas grandes |
| **LIV Vector** (a contratar) | Ilustração vetorial estilizada da mesma personagem em 4 cenas Lottie animadas (Idle, Speaking, Celebrating, Encouraging) | Dia-a-dia (~35% das aparições): dentro de aulas, feedback de exercício |
| **LIV Symbol** | Componente React `LIVSymbol.tsx` — anel azul/roxo animado | Notificações push, ícones pequenos, indicador de "LIV pensando" (~60% das aparições) |

### Componentes React entregues

1. **`LIVSymbol.tsx`** — anel com 5 estados (idle, speaking, thinking, celebrating, concerned). Pronto pra integrar.
2. **`LIVMicrocopyBubble.tsx`** — balão de fala com 6 tons (idle, curious, encouraging, proud, concerned, celebrating). Pronto pra integrar.

### Vídeos da LIV em produção

Pipeline definido: Nano Banana (gera imagem na pose certa) → Kling AI (anima a imagem em vídeo curto MP4).
- Veo do Gemini foi descartado por política anti-deepfake
- Kling AI tem free tier de 6 vídeos/dia e qualidade comparável
- Cenas em produção: "Como quer aprender?", "Aula completa" (contida + intensa), Dashboard idle/aceno/curiosa, apontando pro bubble

### Pool de microcopy (G7)

58 frases escritas, categorizadas em 6 momentos:
- Abertura (8) | Pré-exercício (10) | Pós-acerto (12) | Pós-erro (10) | Transição (10) | Fechamento (8)

Aguarda revisão do Fernando (Item 4 do roadmap).

### Step do pipeline

Edge function `get-microcopy(slide, user, lesson)` decide:
1. Identifica o momento (abertura/pré-ex/pos-acerto/etc)
2. Busca frases ativas da categoria
3. Exclui as 5 usadas mais recentemente pelo usuário (anti-repetição)
4. Sorteia 1
5. Substitui `[Nome]` pelo nome do aluno
6. Registra uso em `liv_phrase_usage`

---

## 10. V5 → V8 Migração

### Decisão estratégica

**Abandonar V5 inteiro. V8 é dominante e superior.**

Razões:
- V8 tem variedade de exercícios que V5 não tem (flashcard, monte-o-prompt, reescrita com IA)
- V8 tem onboarding "Ler ou Ouvir" que respeita autonomia
- V8 tem feedback de IA real
- V5 é container simples; V8 é container rico
- Manter os 2 = dívida técnica + dispersão de produção

### Plano de migração

1. **Marca V5 como deprecated HOJE** — não cria mais aulas V5
2. **Aulas V5 atuais continuam funcionando** durante a migração (não derrubam o ar)
3. **Script de migração** (Claude Code): lê estrutura V5, transpõe pra schema V8 sem regravar áudio (TTS é o mesmo)
4. **Exercícios novos** (monte-o-prompt, reescrita) são OPCIONAIS por aula migrada
5. **Migração em batches** — 1 trilha por vez, valida, segue

### Custo da migração

- Médio. Script ~6h de Claude Code + 1h por trilha de validação.
- Sem regravar áudio = sem custo de produção de conteúdo
- **NÃO incluído nas 116h do MVP** — migração roda em paralelo

---

## 11. Arquivos Anexos / Referências

Pasta do projeto: `/Users/fernandocanuto/Documents/Claude/Projects/APP AI education/`

### Componentes React entregues

- `LIVSymbol.tsx` — anel da LIV (5 estados de animação CSS)
- `LIVMicrocopyBubble.tsx` — balão de fala (6 tons, auto-hide)

### Docs estratégicos

- `liv-execucao-mvp.md` — receita executiva de produção da LIV (3 camadas + freela Lottie)
- `liv-destravar.md` — plano de comparação Foto vs Vector
- `liv-spec-v2-explicada.md` — spec didática da LIV no V8
- `liv-mockup-v8.html` — mockup interativo da LIV no V8
- `liv-pool-frases-v8.md` — 58 frases categorizadas (aguarda revisão)
- `liv-microcopy-generator.md` — prompt Claude pra gerar microcopy + 35 frases fallback

### Docs de produção visual da LIV

- `liv-freelancer-brief-lottie-creator-EN.md` — briefing pra freela Lottie em inglês
- `liv-video-prompts-veo-gemini.md` — prompts pras 2 cenas iniciais
- `liv-video-dashboard-cenas.md` — 3 cenas do dashboard
- `liv-video-jornada-completa-v2.md` — versão com energia genuína
- `liv-video-apontando-bubble.md` — LIV apontando pro balão
- `liv-video-sora-prompt.md` — fallback Sora
- `liv-video-alternativas-veo-bloqueio.md` — Kling AI / Runway / Hailuo
- `liv-video-comemoracao-intensa-kling.md` — comemoração "YES energy"

### Docs deste projeto

- `plano-ailiv-v2-spec-consolidada.md` — este arquivo (master plan)
- `gaps-implementacao-tecnica.md` — anexo técnico (schemas SQL + edge functions detalhadas)

---

## 12. Próximos Passos

### Imediato

- ✅ **Item 1 (este doc):** Spec MD consolidada — feito + revisado
- ✅ **Item 2:** Detalhar implementação técnica de cada gap — feito + revisado
- 🔲 **Item 3:** Mapa de telas/UX da gamificação nova (mockups HTML). Trabalho colaborativo.
- 🔲 **Item 4:** Revisar e fechar pool de 58 frases da LIV. Trabalho colaborativo.

### Depois do roadmap completo (1+2+3+4)

- Mandar o pacote pro Claude Code começar a implementação
- Fernando valida cada feature conforme entregue
- QA final + lançamento do MVP em ~3-4 semanas

### Pós-MVP (V1.1 / V2)

- Ligas semanais (após 50+ alunos ativos)
- Crowns Prata (3º nível de maestria)
- LIV Chat (modal de perguntas com Claude API)
- Lottie animado da LIV (quando freela entregar)
- Friend Quest avançado (Quest Dupla)
- A/B test de tom de microcopy
- Streak Society completo
- Social (seguir, 1v1, gifts)

---

## Anexo A — Princípios de Design pra Adulto 38+

Princípios que guiam todas as decisões de gamificação deste plano. Em caso de dúvida sobre uma feature, **volta aqui.**

1. **Punição existe, mas a saída também.** Hearts cai, mas Practice to Earn salva. Streak quebra, mas Streak Freeze protege.
2. **Streak diário, sim. Cobrança dramática, não.** O tom é "sua sequência tá viva — 2 minutinhos preservam ela", não "VOCÊ VAI PERDER TUDO!".
3. **Competição, sim. Mas só com massa crítica.** Liga semanal só quando tiver 50+ alunos ativos. Antes disso, foco em progresso pessoal.
4. **Mascote, sim. Mas adulto.** A LIV é uma profissional, não um pinguim. Foto realista + ilustração estilizada (Headspace-like), nunca cartoon infantil.
5. **Recompensa visível, sim. Inflação, não.** XP e coins têm propósito — gastar na loja. Não acumular ad infinitum.
6. **Conquistas raras valem ouro.** Energia alta perde valor se aparece toda hora. Reserve celebração intensa pra momentos raros.
7. **Onboarding gamificado, mas curto.** XP em <60s, 3 perguntas no máximo, primeira ação real antes de qualquer explicação.
8. **Maturidade > entusiasmo forçado.** Microcopy da LIV é direta, calorosa, profissional. Sem "BORA!", "MANDA VER!", "INCRÍVEL!!!".
9. **Adulto valoriza tempo.** Daily Goal escolhido pelo aluno (10/20/30/50 XP). Tempo estimado visível em cada aula. Botão "Pausar pra continuar depois" presente em tudo.
10. **Justiça > engenharia de receita.** Ultra cancelado mantém benefícios até fim do período. Hearts restaurados após cancelamento. Goodwill > squeeze de últimos centavos.

---

## Anexo B — Glossário

| Termo | Significado |
|-------|-------------|
| **AI Academy** | Nome público da plataforma (usado em UI) |
| **AILIV** | Nome técnico/interno do projeto |
| V5 / V8 | Formatos de aula da plataforma. V8 é o atual dominante. V5 deprecated. |
| LIV | Assistente virtual da plataforma (foto realista de mulher ~35 anos) |
| FAB | Floating Action Button — o círculo da LIV sempre visível |
| Bubble | Balão de fala da LIV com microcopy |
| `power_score` | Pontuação cumulativa eterna do aluno (define patente) |
| Patente | Nível do aluno baseado em faixas de power_score (Iniciante → Mestre) |
| `total_points` | Sistema antigo de pontuação (apagado na Fase 1) |
| Practice to Earn | Sessão de revisão pra ganhar hearts de volta sem pagar |
| Streak Freeze | Item da loja que protege a sequência diária por 1 dia |
| XP Boost | Item da loja — multiplicador 2× de XP por 15 minutos |
| Lottie | Formato de animação vetorial leve, padrão da indústria web/app |
| Nano Banana | Apelido do Gemini 2.5 Flash Image (geração de imagem do Google) |
| Veo | Modelo de geração de vídeo do Google (Veo 3 atual) |
| Kling AI | Plataforma alternativa de geração de vídeo (image-to-video) |
| RLS | Row Level Security — feature do Postgres/Supabase pra controle de acesso por linha |
| BRT | Brasília Time (UTC-3) — fuso default antes da detecção de timezone |

---

## Anexo C — Sumário de Decisões (referência rápida)

Atalho pra consulta rápida durante implementação.

| Categoria | Decisão | Onde |
|-----------|---------|------|
| **Hearts** | Caem em TODOS os exercícios | §4 Decisão 1 |
| **Hearts** | Practice to Earn obrigatório | G6 |
| **API Playground** | Mantém Gemini Flash (não migra) | §4 Decisão 2 |
| **total_points** | Apaga, refatora Leaderboard | §4 Decisão 3 |
| **Ultra cancelado** | Mantém até fim do período + restaura 5/5 | §4 Decisão 4 |
| **ID type** | UUID em tudo | §5 Aud-1 |
| **RLS** | `auth.uid() = user_id` padrão | §5 Aud-1 |
| **power_score** | Cumulativo eterno (XP + conquistas + milestones) | §5 Aud-2 |
| **Patentes** | 5 níveis (0/100/500/1.500/5.000) | §5 Aud-3 |
| **Streak** | Avança só ao bater daily_goal; Freeze ou reseta | §5 Aud-4 |
| **Timezone** | `users.timezone` + detecção automática | §5 Aud-5 |
| **Daily Goal** | 4 valores (10/20/30/50), cooldown 7d | G1 |
| **Path** | Linear, Boss especial, Ouro = ≥95%+todos acertos | G3 |
| **Combo** | Reseta por lição, 3=+2/5=+5/10=+10+5c | G5 |
| **Notif push** | Após 1º dia válido, quiet 22-7h, inativo 1×/3d | G7 |
| **Onboarding** | 7 telas, obrigatório, mini-experiência IA pré-preenchida | G8 |
| **Friend Quest** | 100c+100c=200 cada, limite 20/mês, WhatsApp+copy+nativo | G9 |
| **XP Boost** | 150c/15min/2×XP, renova (não acumula), só XP | G10 |
| **Crowns** | 2 níveis MVP (Bronze + Ouro), Prata pra V1.1 | G4 |

---

**Fim do documento.**

Próximo passo: ler `gaps-implementacao-tecnica.md` (anexo técnico) e começar implementação pelo Claude Code.
