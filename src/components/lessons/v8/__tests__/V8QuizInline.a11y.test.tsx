import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { V8QuizInline } from "../V8QuizInline";
import type { V8InlineQuiz } from "@/types/v8Lesson";

vi.mock("../v8Confetti", () => ({ fireInlineConfetti: vi.fn() }));
vi.mock("@/components/lessons/v7/cinematic/useV7SoundEffects", () => ({
  useV7SoundEffects: () => ({ playSound: vi.fn() }),
}));

const mockQuiz: V8InlineQuiz = {
  id: "q1",
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

describe("V8QuizInline a11y", () => {
  it("não tem violações axe no estado inicial", async () => {
    const { container } = render(
      <V8QuizInline quiz={mockQuiz} onAnswer={() => {}} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("usa padrão WAI-ARIA radiogroup", () => {
    const { getByRole, getAllByRole } = render(
      <V8QuizInline quiz={mockQuiz} onAnswer={() => {}} />
    );
    expect(getByRole("radiogroup")).toBeInTheDocument();
    expect(getAllByRole("radio")).toHaveLength(3);
  });

  it("radiogroup tem aria-labelledby apontando para a pergunta", () => {
    const { getByRole } = render(
      <V8QuizInline quiz={mockQuiz} onAnswer={() => {}} />
    );
    const group = getByRole("radiogroup");
    const labelId = group.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    const heading = document.getElementById(labelId!);
    expect(heading).toHaveTextContent("Qual é a capital do Brasil?");
  });

  it("roving tabIndex: apenas um radio tabbable inicialmente", () => {
    const { getAllByRole } = render(
      <V8QuizInline quiz={mockQuiz} onAnswer={() => {}} />
    );
    const radios = getAllByRole("radio");
    const tabbable = radios.filter((r) => r.getAttribute("tabindex") === "0");
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toBe(radios[0]);
  });

  it("aria-checked começa false em todos e vira true ao clicar", async () => {
    const user = userEvent.setup();
    const { getAllByRole } = render(
      <V8QuizInline quiz={mockQuiz} onAnswer={() => {}} />
    );
    const radios = getAllByRole("radio");
    radios.forEach((r) => expect(r).toHaveAttribute("aria-checked", "false"));

    await user.click(radios[1]);
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    expect(radios[0]).toHaveAttribute("aria-checked", "false");
    expect(radios[2]).toHaveAttribute("aria-checked", "false");
  });

  it("ArrowDown move foco para o próximo radio e seleciona", async () => {
    const user = userEvent.setup();
    const { getAllByRole } = render(
      <V8QuizInline quiz={mockQuiz} onAnswer={() => {}} />
    );
    const radios = getAllByRole("radio") as HTMLElement[];
    radios[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(radios[1]).toHaveFocus();
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
  });

  it("ArrowUp do primeiro vai para o último (wrap)", async () => {
    const user = userEvent.setup();
    const { getAllByRole } = render(
      <V8QuizInline quiz={mockQuiz} onAnswer={() => {}} />
    );
    const radios = getAllByRole("radio") as HTMLElement[];
    radios[0].focus();
    await user.keyboard("{ArrowUp}");
    expect(radios[2]).toHaveFocus();
  });

  it("Home vai para o primeiro, End para o último", async () => {
    const user = userEvent.setup();
    const { getAllByRole } = render(
      <V8QuizInline quiz={mockQuiz} onAnswer={() => {}} />
    );
    const radios = getAllByRole("radio") as HTMLElement[];
    radios[1].focus();
    await user.keyboard("{End}");
    expect(radios[2]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(radios[0]).toHaveFocus();
  });
});
