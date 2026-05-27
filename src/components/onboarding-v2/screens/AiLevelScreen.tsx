import { ChoiceCard } from "../ChoiceCard";
import { QuestionLayout } from "../QuestionLayout";
import { useSingleChoiceGate } from "../useSingleChoiceGate";

interface AiLevelScreenProps {
  selected?: string;
  onSelect: (value: string) => void | Promise<void>;
  onBack?: () => void;
}

// Removidas as opções negativas do v1 ("intimidado", "medo de substituição").
const OPTIONS = [
  { value: "none", label: "Nunca usei", subtitle: "Quero começar do zero", emoji: "😬" },
  { value: "beginner", label: "Já mexi um pouco", subtitle: "Curiosidade sem prática", emoji: "🤔" },
  { value: "intermediate", label: "Uso às vezes", subtitle: "Em tarefas pontuais", emoji: "😊" },
  { value: "advanced", label: "Uso direto, todo dia", subtitle: "Já é parte do meu dia", emoji: "😎" },
];

export const AiLevelScreen = ({
  selected,
  onSelect,
  onBack,
}: AiLevelScreenProps) => {
  const gate = useSingleChoiceGate(onSelect, selected);
  return (
    <QuestionLayout
      question="Quanto você usa IA hoje?"
      subtitle="Isso ajuda a LIV a calibrar a primeira aula."
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
