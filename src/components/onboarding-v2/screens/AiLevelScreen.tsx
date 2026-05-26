import { ChoiceCard } from "../ChoiceCard";
import { QuestionLayout } from "../QuestionLayout";

interface AiLevelScreenProps {
  selected?: string;
  onSelect: (value: string) => void;
  onBack?: () => void;
}

// Removidas as opções negativas do v1 ("intimidado", "medo de substituição").
// Foco no nível ATUAL de uso, sem framing emocional.
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
}: AiLevelScreenProps) => (
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
        selected={selected === opt.value}
        onClick={() => onSelect(opt.value)}
      />
    ))}
  </QuestionLayout>
);
