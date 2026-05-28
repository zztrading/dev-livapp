import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { ChoiceCard } from "../ChoiceCard";
import { QuestionLayout } from "../QuestionLayout";

interface MotivationScreenProps {
  /** Valor salvo (CSV: "income,growth,..."), opcional */
  selected?: string;
  /** Recebe CSV das escolhas (1 a 3 valores separados por vírgula) */
  onSelect: (value: string) => void | Promise<void>;
  onBack?: () => void;
}

const OPTIONS = [
  { value: "income", label: "Gerar renda extra", emoji: "💰" },
  { value: "growth", label: "Crescimento profissional", emoji: "🚀" },
  { value: "productivity", label: "Aumentar produtividade", emoji: "⚡" },
  { value: "future", label: "Planejar meu futuro", emoji: "🏠" },
  { value: "learning", label: "Curiosidade", emoji: "🧠" },
];

const MAX_PICKS = 3;

export const MotivationScreen = ({
  selected,
  onSelect,
  onBack,
}: MotivationScreenProps) => {
  // Hidrata estado local com CSV pré-existente (volta atrás preserva escolha)
  const [picked, setPicked] = useState<string[]>(() =>
    selected
      ? selected
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
          .slice(0, MAX_PICKS)
      : [],
  );
  const [submitting, setSubmitting] = useState(false);

  // Sync com prop externa quando muda (ex: refresh)
  useEffect(() => {
    if (!selected) return;
    const fromProp = selected
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, MAX_PICKS);
    setPicked(fromProp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const togglePick = useCallback((value: string) => {
    setPicked((prev) => {
      if (prev.includes(value)) {
        // Já selecionado → remove
        return prev.filter((v) => v !== value);
      }
      // Não selecionado → adiciona, capando em MAX_PICKS
      if (prev.length >= MAX_PICKS) return prev;
      return [...prev, value];
    });
  }, []);

  const handleContinue = useCallback(async () => {
    if (submitting || picked.length === 0) return;
    setSubmitting(true);
    try {
      await onSelect(picked.join(","));
    } finally {
      setSubmitting(false);
    }
  }, [submitting, picked, onSelect]);

  const remaining = MAX_PICKS - picked.length;
  const canContinue = picked.length >= 1 && !submitting;

  return (
    <QuestionLayout
      question="O que mais quer alcançar?"
      subtitle={`Selecione até ${MAX_PICKS} ${picked.length > 0 ? `· ${picked.length} de ${MAX_PICKS}` : ""}`}
      onBack={onBack}
    >
      {OPTIONS.map((opt) => {
        const isSelected = picked.includes(opt.value);
        const reachedMax = picked.length >= MAX_PICKS && !isSelected;
        return (
          <ChoiceCard
            key={opt.value}
            emoji={opt.emoji}
            label={opt.label}
            selected={isSelected}
            disabled={reachedMax || submitting}
            onClick={() => togglePick(opt.value)}
          />
        );
      })}

      <AnimatePresence>
        {picked.length > 0 && (
          <motion.button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            whileTap={canContinue ? { scale: 0.97 } : undefined}
            className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-base font-bold shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                Continuar {remaining > 0 && `(+${remaining})`}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </QuestionLayout>
  );
};
