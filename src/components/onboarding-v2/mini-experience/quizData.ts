/**
 * Dados dos 4 quizzes do mini-experience.
 *
 * Cada quiz tem:
 *   - 2-3 opções com IDs ('a' | 'b' | 'c')
 *   - Resposta correta
 *   - Feedback ESPECÍFICO por opção (não só certo/errado — explica por quê)
 *
 * Princípio: distratores plausíveis. Adulto não pode achar "óbvio qual é".
 */

export interface QuizOption {
  id: string;
  label: string;
  description?: string;
}

export interface QuizDefinition {
  key: "input" | "persona" | "context" | "critique";
  /** título curto do tópico (aparece em header) */
  topic: string;
  /** narrativa que introduz a pergunta */
  intro: string;
  question: string;
  options: QuizOption[];
  correctId: string;
  feedback: Record<string, string>;
}

export const QUIZZES: QuizDefinition[] = [
  // ─── Tela 2 — Erro de Input ─────────────────────────────────────────
  {
    key: "input",
    topic: "O Erro de Input",
    intro:
      "Você abre o ChatGPT e digita: \"Crie estratégia pro meu projeto\".",
    question: "O que mais provavelmente acontece?",
    options: [
      {
        id: "a",
        label: "Cria um plano completo e pronto pra executar",
      },
      {
        id: "b",
        label:
          "Gera texto genérico que serve pra qualquer projeto e na prática não serve pra nenhum",
      },
      {
        id: "c",
        label: "Pergunta de volta pedindo mais contexto antes de responder",
      },
    ],
    correctId: "b",
    feedback: {
      a: "Quase. A IA até gera um plano, mas é genérico — qualquer outra pessoa receberia o mesmo texto. Não serve pra VOCÊ executar nada.",
      b: "Exato. IA sem contexto = sopa morna. Por isso aprender a contextualizar separa quem usa IA de quem só brinca com IA.",
      c: "Faria sentido, mas a maioria das IAs entrega na hora, sem perguntar. Por isso VOCÊ tem que contextualizar ANTES.",
    },
  },

  // ─── Tela 3 — Persona ───────────────────────────────────────────────
  {
    key: "persona",
    topic: "O Pilar da Persona",
    intro: "Pra IA parar de responder como robô chato:",
    question: "Qual comando ativa a melhor Persona?",
    options: [
      {
        id: "a",
        label: "\"Seja inteligente e detalhado nas respostas\"",
      },
      {
        id: "b",
        label:
          "\"Aja como especialista experiente da área que estou perguntando, com 15 anos de prática\"",
      },
      {
        id: "c",
        label: "\"Responda como um especialista da área\"",
      },
    ],
    correctId: "b",
    feedback: {
      a: "Quase. \"Seja inteligente\" não diz NADA pra IA — ela não sabe o que é inteligente no SEU contexto. Persona precisa ser específica.",
      b: "Isso. Especificidade + tempo de experiência = IA muda o tom completamente.",
      c: "Quase. Faltou especificidade — \"experiente\" e \"15 anos de prática\" fazem a diferença.",
    },
  },

  // ─── Tela 4 — Engenharia de Contexto ────────────────────────────────
  {
    key: "context",
    topic: "Engenharia de Contexto",
    intro: "Você quer planejar uma viagem pra Lisboa.",
    question: "Qual prompt entrega plano REAL?",
    options: [
      {
        id: "a",
        label:
          "\"crie um roteiro pra eu lisboa 7 dias outubro com minha esposa to com 5000 euros gostamos de comida boa e historia to perdido\"",
      },
      {
        id: "b",
        label:
          "\"Aja como guia de Lisboa. Contexto: 7 dias, casal, €5000, comida + história. Entregue: roteiro dia a dia, restaurantes com preço, plano B se chover.\"",
      },
    ],
    correctId: "b",
    feedback: {
      a: "Quase. O Prompt A tem TODA a informação solta, mas sem estrutura. A IA vai gerar resposta vaga. Já o Prompt B organiza a MESMA informação em CONTEXTO + ENTREGUE. Diferença brutal.",
      b: "Isso é Engenharia de Contexto. O Prompt B faz a IA entregar roteiro que VOCÊ pode executar amanhã. O Prompt A vira texto vago que serve pra qualquer viagem — e nenhuma de verdade.",
    },
  },

  // ─── Tela 7 — Critique Loop ─────────────────────────────────────────
  {
    key: "critique",
    topic: "Critique Loop",
    intro: "A IA te deu uma resposta mediana.",
    question: "Como pedir pra ela MELHORAR a própria resposta?",
    options: [
      {
        id: "a",
        label: "\"Reescreve melhor\"",
      },
      {
        id: "b",
        label: "\"Tenta de novo, mas pensa mais antes de responder\"",
      },
      {
        id: "c",
        label:
          "\"Identifique os 3 pontos mais fracos da resposta acima. Reescreva eliminando esses pontos. Justifique cada mudança.\"",
      },
    ],
    correctId: "c",
    feedback: {
      a: "IA não sabe o que melhorar — ela vai repetir bobagem com sinônimos diferentes.",
      b: "IA tenta, mas sem critério. Você precisa DIRIGIR a auto-crítica.",
      c: "Você ativou um Critique Loop — pediu pra IA criticar o próprio trabalho e refazer. Você acabou de aprender uma técnica que 99% dos usuários de IA nunca ouviu falar.",
    },
  },
];
