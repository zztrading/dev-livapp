import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { V8QuizTrueFalse } from "../V8QuizTrueFalse";
import type { V8InlineQuiz } from "@/types/v8Lesson";

vi.mock("../v8Confetti", () => ({ fireInlineConfetti: vi.fn() }));
vi.mock("@/components/lessons/v7/cinematic/useV7SoundEffects", () => ({
  useV7SoundEffects: () => ({ playSound: vi.fn() }),
}));

const mockQuiz: V8InlineQuiz = {
  id: "q1",
  afterSectionIndex: 0,
  question: "Avalie:",
  options: [],
  explanation: "Sim, a Terra é redonda.",
  quizType: "true-false",
  statement: "A Terra é redonda.",
  isTrue: true,
};

describe("V8QuizTrueFalse a11y", () => {
  it("não tem violações axe no estado inicial", async () => {
    const { container } = render(
      <V8QuizTrueFalse quiz={mockQuiz} onAnswer={() => {}} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("usa padrão WAI-ARIA radiogroup com 2 opções", () => {
    const { getByRole, getAllByRole } = render(
      <V8QuizTrueFalse quiz={mockQuiz} onAnswer={() => {}} />
    );
    expect(getByRole("radiogroup")).toBeInTheDocument();
    const radios = getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveTextContent("Verdadeiro");
    expect(radios[1]).toHaveTextContent("Falso");
  });

  it("radiogroup tem aria-labelledby apontando para a sentença", () => {
    const { getByRole } = render(
      <V8QuizTrueFalse quiz={mockQuiz} onAnswer={() => {}} />
    );
    const group = getByRole("radiogroup");
    const labelId = group.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    const sentence = document.getElementById(labelId!);
    expect(sentence).toHaveTextContent("A Terra é redonda.");
  });

  it("roving tabIndex: apenas um radio tabbable inicialmente", () => {
    const { getAllByRole } = render(
      <V8QuizTrueFalse quiz={mockQuiz} onAnswer={() => {}} />
    );
    const radios = getAllByRole("radio");
    const tabbable = radios.filter((r) => r.getAttribute("tabindex") === "0");
    expect(tabbable).toHaveLength(1);
  });

  it("ArrowRight move foco entre as opções (wrap)", async () => {
    const user = userEvent.setup();
    const { getAllByRole } = render(
      <V8QuizTrueFalse quiz={mockQuiz} onAnswer={() => {}} />
    );
    const radios = getAllByRole("radio") as HTMLElement[];
    radios[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(radios[1]).toHaveFocus();
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{ArrowRight}");
    expect(radios[0]).toHaveFocus();
  });

  it("clicar em radio seta aria-checked corretamente", async () => {
    const user = userEvent.setup();
    const { getAllByRole } = render(
      <V8QuizTrueFalse quiz={mockQuiz} onAnswer={() => {}} />
    );
    const radios = getAllByRole("radio");
    await user.click(radios[0]);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(radios[1]).toHaveAttribute("aria-checked", "false");
  });
});
