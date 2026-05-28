import { ChoiceCard } from "../ChoiceCard";
import { QuestionLayout } from "../QuestionLayout";
import { useSingleChoiceGate } from "../useSingleChoiceGate";

interface AiLevelScreenProps {
  selected?: string;
  onSelect: (value: string) => void | Promise<void>;
  onBack?: () => void;
}

// Valores devem bater com CHECK constraint da migration M0.1:
//   ai_usage_level IN ('nunca','testei','as_vezes','todo_dia')
const OPTIONS = [
  { value: "nunca", label: "Nunca usei IA", emoji: "😬" },
  { value: "testei", label: "Já testei algumas vezes", emoji: "🤔" },
  { value: "as_vezes", label: "Uso de vez em quando", emoji: "😊" },
  { value: "todo_dia", label: "Uso todo dia", emoji: "😎" },
];

export const AiLevelScreen = ({
  selected,
  onSelect,
  onBack,
}: AiLevelScreenProps) => {
  const gate = useSingleChoiceGate(onSelect, selected);
  return (
    <QuestionLayout
      question="Qual é seu nível com IA hoje?"
      subtitle="Isso ajuda a LIV a calibrar a primeira aula."
      onBack={onBack}
    >
      {OPTIONS.map((opt) => (
        <ChoiceCard
          key={opt.value}
          emoji={opt.emoji}
          label={opt.label}
          selected={gate.selected === opt.value}
          disabled={gate.isLocked}
          onClick={() => gate.handlePick(opt.value)}
        />
      ))}
    </QuestionLayout>
  );
};
