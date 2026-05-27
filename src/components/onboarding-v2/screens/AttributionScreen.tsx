import { ChoiceCard } from "../ChoiceCard";
import { QuestionLayout } from "../QuestionLayout";
import { useSingleChoiceGate } from "../useSingleChoiceGate";

interface AttributionScreenProps {
  selected?: string;
  onSelect: (value: string) => void | Promise<void>;
  onBack?: () => void;
}

const OPTIONS = [
  { value: "instagram", label: "Instagram", emoji: "📱" },
  { value: "google", label: "Google", emoji: "🔍" },
  { value: "tiktok", label: "TikTok", emoji: "🎵" },
  { value: "youtube", label: "YouTube", emoji: "▶️" },
  { value: "referral", label: "Amigo ou família", emoji: "👥" },
  { value: "other", label: "Outro", emoji: "✨" },
];

export const AttributionScreen = ({
  selected,
  onSelect,
  onBack,
}: AttributionScreenProps) => {
  const gate = useSingleChoiceGate(onSelect, selected);
  return (
    <QuestionLayout
      question="Como você conheceu a YesLiv?"
      subtitle="Vai nos ajudar a mostrar mais conteúdo pra mais gente."
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
