# Onboarding Ideas — Fluxo de Entrada com a Liv

> Plano de onboarding gamificado para o app, focado em criar **desejo absoluto** antes de pedir cadastro. Usa a Liv (avatar/AI guia) como gancho emocional e diagnóstico personalizado como prova de valor.

---

## Visão geral

| Etapa | Objetivo emocional | Resultado esperado |
|---|---|---|
| Passo 1 | Curiosidade | Usuário sente que vai descobrir algo sobre si |
| Passo 2 | Ansiedade construtiva | Usuário percebe o quanto está perdendo |
| Passo 3 | Desejo absoluto | Usuário visualiza o ganho concreto |
| Passo 4 | Ação | Usuário se cadastra para destravar o plano |

**Princípio**: pedido de e-mail/senha só no Passo 4 — pedir antes corta o desejo.

---

## Passo 1 — O Gancho da Curiosidade

**Onde aparece:** tela de entrada, antes de qualquer cadastro.

**Quem fala:** Liv (animação simpática + voz/texto).

### Texto na tela

**🇺🇸 EUA**
> "Hi! I'm Liv. Before we start, let me ask you: How many hours did you waste this week on repetitive tasks that a 10-second AI prompt could have solved for you?"

**🇧🇷 BR**
> "Oi! Eu sou a Liv. Antes de começar, me responde uma coisa: Quantas horas você perdeu essa semana com tarefas repetitivas que um comando de 10 segundos de IA resolveria para você?"

### CTA

Botão grande e chamativo:
- **EUA:** `Let's find out`
- **BR:** `Vamos descobrir`

---

## Passo 2 — O Teste do Termômetro

**Objetivo:** gerar **ansiedade construtiva**. Fazer o usuário perceber o quanto está deixando de ganhar dinheiro ou tempo por não usar IA.

**Formato:** 3 perguntas rápidas de múltipla escolha.

### Pergunta 1 — Profissão

> Qual a sua profissão ou principal atividade hoje?

Opções: Vendas · Autônomo · Gestão · Educação · Outros

### Pergunta 2 — Sentimento em relação à IA

> Como você se sente quando as pessoas falam sobre ChatGPT, Midjourney ou automações?

Opções:
- "Sinto que estou ficando para trás"
- "Acho confuso"
- "Quero usar, mas não sei por onde começar"

### Pergunta 3 — Meta de tempo

> Quanto tempo você gostaria de salvar na sua semana profissional?

Opções: 5 horas · 10 horas · Mais de 15 horas

---

## Passo 3 — O "Momento Uau" Personalizado

**Objetivo:** gerar **desejo absoluto**. Entregar diagnóstico de impacto imediato baseado nas respostas do Passo 2.

**Transição:** animação bonita de "carregando seu plano personalizado".

### Exemplo de resultado

> Quando o usuário escolhe **"Vendas"** + **"Quero usar, mas não sei por onde começar"**.

**🇺🇸 EUA**
> **Your Professional AI Diagnostic:**
> - **Profession:** Sales & Business
> - **Potential Time Saved:** 12 hours/week
>
> **What Liv will unlock for you today:**
> - An AI strategy to double your client replies in 5 minutes.
> - The exact tool to automate your weekly reports while you sleep.

**🇧🇷 BR**
> **Seu Diagnóstico Profissional de IA:**
> - **Profissão:** Vendas e Negócios
> - **Tempo Potencial Economizado:** 12 horas por semana
>
> **O que a Liv vai destravar para você hoje:**
> - A estratégia de IA para duplicar suas respostas a clientes em 5 minutos.
> - A ferramenta exata para automatizar seus relatórios semanais enquanto você dorme.

### Implementação

O diagnóstico deve ser **dinâmico** — varia por combinação de respostas (profissão × sentimento × meta). Cada combinação entrega:
1. Diagnóstico nominal da profissão
2. Estimativa quantitativa de tempo salvo
3. 2 promessas concretas e específicas

---

## Passo 4 — O Fechamento Magnético

**Objetivo:** converter o usuário no ápice da curiosidade. Ele já sabe o que vai ganhar e o quanto está perdendo se fechar o app agora.

### Texto na tela

**🇺🇸 EUA**
> "Your personalized AI roadmap is ready. Adults who use this formula are already saving 1.5 working days every single week. Ready to take your time back?"

**🇧🇷 BR**
> "Seu plano personalizado de IA está pronto. Profissionais que usam essa fórmula já estão economizando 1 dia e meio de trabalho toda semana. Pronto para pegar seu tempo de volta?"

### CTA

- **EUA:** `Start My Free Trial`
- **BR:** `Começar Meu Teste Grátis`

### Tela de cadastro

**Princípio:** 1 clique só.

Opções de login:
- Continuar com Google
- Continuar com Apple
- (e-mail/senha como fallback discreto)

---

## Notas de implementação

- **Sem cadastro até o Passo 4** — qualquer coleta antes mata o funil.
- **Liv como personagem único** ao longo dos 4 passos: mesma voz, mesma identidade visual.
- **Animações de transição** entre passos importam: o "loading" do Passo 3 é parte do show.
- **Bilíngue desde o começo** — detectar `navigator.language` na inicialização ou perguntar idioma no boot.
- **A/B test no Passo 1**: testar variações do gancho (foco em tempo vs. dinheiro vs. medo de ficar para trás).
- **Métricas chave**: taxa de conclusão por passo, drop-off no Passo 4 (cadastro), tempo médio de cada passo.
