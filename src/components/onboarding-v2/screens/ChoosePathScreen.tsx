import { ChoiceCard } from "../ChoiceCard";
import { QuestionLayout } from "../QuestionLayout";
import { useSingleChoiceGate } from "../useSingleChoiceGate";

interface ChoosePathScreenProps {
  selected?: string;
  onSelect: (value: string) => void | Promise<void>;
  onBack?: () => void;
}

const OPTIONS = [
  {
    value: "zero",
    emoji: "📘",
    label: "Começar do zero",
    subtitle: "Faça a aula mais fácil pra entender a base",
  },
  {
    value: "placement",
    emoji: "🧭",
    label: "Encontrar meu nível",
    subtitle: "A LIV vai recomendar por onde começar baseado no desafio",
  },
];

export const ChoosePathScreen = ({
  selected,
  onSelect,
  onBack,
}: ChoosePathScreenProps) => {
  const gate = useSingleChoiceGate(onSelect, selected);
  return (
    <QuestionLayout
      question="Agora vamos achar onde você começa."
      onBack={onBack}
    >
      {OPTIONS.map((opt) => (
        <ChoiceCard
          key={opt.value}
          emoji={opt.emoji}
          label={opt.label}
          subtitle={opt.subtitle}
          selected={gate.selected === opt.value}
          disabled={gate.isLocked}
          onClick={() => gate.handlePick(opt.value)}
        />
      ))}
    </QuestionLayout>
  );
};
