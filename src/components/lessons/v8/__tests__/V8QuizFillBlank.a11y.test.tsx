import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { V8QuizFillBlank } from "../V8QuizFillBlank";
import type { V8InlineQuiz } from "@/types/v8Lesson";

vi.mock("../v8Confetti", () => ({ fireInlineConfetti: vi.fn() }));
vi.mock("@/components/lessons/v7/cinematic/useV7SoundEffects", () => ({
  useV7SoundEffects: () => ({ playSound: vi.fn() }),
}));

const quizWithChips: V8InlineQuiz = {
  id: "q1",
  afterSectionIndex: 0,
  question: "Complete a frase:",
  options: [],
  explanation: "Brasília é a capital.",
  quizType: "fill-blank",
  sentenceWithBlank: "A capital do Brasil é _______.",
  correctAnswer: "Brasília",
  chipOptions: ["São Paulo", "Brasília", "Rio de Janeiro"],
};

const quizWithoutChips: V8InlineQuiz = {
  ...quizWithChips,
  chipOptions: undefined,
};

describe("V8QuizFillBlank a11y — modo chips", () => {
  it("não tem violações axe no estado inicial", async () => {
    const { container } = render(
      <V8QuizFillBlank quiz={quizWithChips} onAnswer={() => {}} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("usa padrão WAI-ARIA radiogroup com chips", () => {
    const { getByRole, getAllByRole } = render(
      <V8QuizFillBlank quiz={quizWithChips} onAnswer={() => {}} />
    );
    expect(getByRole("radiogroup")).toBeInTheDocument();
    expect(getAllByRole("radio")).toHaveLength(3);
  });

  it("roving tabIndex: apenas um chip tabbable inicialmente", () => {
    const { getAllByRole } = render(
      <V8QuizFillBlank quiz={quizWithChips} onAnswer={() => {}} />
    );
    const radios = getAllByRole("radio");
    const tabbable = radios.filter((r) => r.getAttribute("tabindex") === "0");
    expect(tabbable).toHaveLength(1);
  });

  it("clicar no chip já selecionado mantém seleção (não toggle — hotfix #296)", async () => {
    const user = userEvent.setup();
    const { getAllByRole } = render(
      <V8QuizFillBlank quiz={quizWithChips} onAnswer={() => {}} />
    );
    const radios = getAllByRole("radio");
    await user.click(radios[1]);
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    await user.click(radios[1]);
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
  });

  it("ArrowDown navega e seleciona próximo chip", async () => {
    const user = userEvent.setup();
    const { getAllByRole } = render(
      <V8QuizFillBlank quiz={quizWithChips} onAnswer={() => {}} />
    );
    const radios = getAllByRole("radio") as HTMLElement[];
    radios[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(radios[1]).toHaveFocus();
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
  });

  it("Home/End funcionam", async () => {
    const user = userEvent.setup();
    const { getAllByRole } = render(
      <V8QuizFillBlank quiz={quizWithChips} onAnswer={() => {}} />
    );
    const radios = getAllByRole("radio") as HTMLElement[];
    radios[1].focus();
    await user.keyboard("{End}");
    expect(radios[2]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(radios[0]).toHaveFocus();
  });
});

describe("V8QuizFillBlank a11y — modo texto livre", () => {
  it("não tem violações axe no estado inicial", async () => {
    const { container } = render(
      <V8QuizFillBlank quiz={quizWithoutChips} onAnswer={() => {}} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("input tem aria-labelledby apontando para a frase", () => {
    const { getByRole } = render(
      <V8QuizFillBlank quiz={quizWithoutChips} onAnswer={() => {}} />
    );
    const input = getByRole("textbox");
    const labelId = input.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    const sentence = document.getElementById(labelId!);
    expect(sentence).toHaveTextContent(/A capital do Brasil é/);
  });
});
