import { ChoiceCard } from "../ChoiceCard";
import { QuestionLayout } from "../QuestionLayout";

interface MotivationScreenProps {
  selected?: string;
  onSelect: (value: string) => void;
  onBack?: () => void;
}

const OPTIONS = [
  { value: "income", label: "Gerar renda extra", emoji: "💰" },
  { value: "growth", label: "Crescimento profissional", emoji: "🚀" },
  { value: "productivity", label: "Aumentar produtividade", emoji: "⚡" },
  { value: "future", label: "Planejar meu futuro", emoji: "🏠" },
  { value: "learning", label: "Aprender algo novo", emoji: "🧠" },
];

export const MotivationScreen = ({
  selected,
  onSelect,
  onBack,
}: MotivationScreenProps) => (
  <QuestionLayout
    question="O que mais quer alcançar?"
    subtitle="Vamos personalizar sua trilha pra esse objetivo."
    onBack={onBack}
  >
    {OPTIONS.map((opt) => (
      <ChoiceCard
        key={opt.value}
        emoji={opt.emoji}
        label={opt.label}
        selected={selected === opt.value}
        onClick={() => onSelect(opt.value)}
      />
    ))}
  </QuestionLayout>
);
