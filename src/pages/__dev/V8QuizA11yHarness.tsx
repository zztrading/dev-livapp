// Dev-only harness for V8 quiz a11y testing.
// Rendered at /dev/v8-quiz-a11y when import.meta.env.DEV. Consumed by
// tests/e2e/v8-quiz-a11y.spec.ts (Playwright + axe).
import { V8QuizInline } from "@/components/lessons/v8/V8QuizInline";
import { V8QuizTrueFalse } from "@/components/lessons/v8/V8QuizTrueFalse";
import { V8QuizFillBlank } from "@/components/lessons/v8/V8QuizFillBlank";
import type { V8InlineQuiz } from "@/types/v8Lesson";

const mockInline: V8InlineQuiz = {
  id: "harness-inline",
  afterSectionIndex: 0,
  question: "Qual é a capital do Brasil?",
  options: [
    { id: "a", text: "São Paulo", isCorrect: false },
    { id: "b", text: "Brasília", isCorrect: true },
    { id: "c", text: "Rio de Janeiro", isCorrect: false },
  ],
  explanation: "Brasília é a capital desde 1960.",
  quizType: "multiple-choice",
};

const mockTrueFalse: V8InlineQuiz = {
  id: "harness-tf",
  afterSectionIndex: 0,
  question: "Avalie a afirmação:",
  options: [],
  explanation: "A Terra é redonda.",
  quizType: "true-false",
  statement: "A Terra é redonda.",
  isTrue: true,
};

const mockFillBlankChips: V8InlineQuiz = {
  id: "harness-fb",
  afterSectionIndex: 0,
  question: "Complete:",
  options: [],
  explanation: "Brasília é a capital.",
  quizType: "fill-blank",
  sentenceWithBlank: "A capital do Brasil é _______.",
  correctAnswer: "Brasília",
  chipOptions: ["São Paulo", "Brasília", "Rio de Janeiro"],
};

const noop = () => {};

export default function V8QuizA11yHarness() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-12" data-testid="v8-quiz-a11y-harness">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">V8 Quiz a11y Harness</h1>
        <p className="text-sm text-slate-500 mt-1">
          Página de teste isolada — renderiza os 3 quizzes V8 com mock data para auditoria axe.
        </p>
      </header>

      <section aria-label="V8QuizInline (multiple-choice)" data-testid="harness-inline">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">V8QuizInline</h2>
        <V8QuizInline quiz={mockInline} onAnswer={noop} />
      </section>

      <section aria-label="V8QuizTrueFalse" data-testid="harness-true-false">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">V8QuizTrueFalse</h2>
        <V8QuizTrueFalse quiz={mockTrueFalse} onAnswer={noop} />
      </section>

      <section aria-label="V8QuizFillBlank (chips)" data-testid="harness-fill-blank">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">V8QuizFillBlank</h2>
        <V8QuizFillBlank quiz={mockFillBlankChips} onAnswer={noop} />
      </section>
    </main>
  );
}
