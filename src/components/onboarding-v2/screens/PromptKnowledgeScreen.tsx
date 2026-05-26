import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { LivCornerAvatar } from "../LivCornerAvatar";

interface PromptKnowledgeScreenProps {
  selected?: string;
  onSelect: (value: string) => void;
  onBack?: () => void;
}

// 2 opções grandes que substituem a tela "Choose Path".
// Resposta define automaticamente onde a primeira aula começa
// (sem o usuário precisar escolher caminho — Sprint 4 usa essa info).
const OPTIONS = [
  {
    value: "knows",
    emoji: "🙋",
    label: "Sei sim",
    description: "Já escrevi prompts pra IA",
  },
  {
    value: "doesnt_know",
    emoji: "🤷",
    label: "Nunca ouvi falar",
    description: "Quero entender desde o básico",
  },
];

export const PromptKnowledgeScreen = ({
  selected,
  onSelect,
  onBack,
}: PromptKnowledgeScreenProps) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
    className="min-h-screen flex flex-col px-5 sm:px-6 pt-6 pb-10"
  >
    {/* Header */}
    <div className="flex items-center justify-between mb-8 max-w-md w-full mx-auto">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      ) : (
        <span className="w-9" aria-hidden="true" />
      )}
      <LivCornerAvatar />
    </div>

    {/* Pergunta */}
    <div className="max-w-md w-full mx-auto mb-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
        Você já sabe o que é um prompt de IA?
      </h1>
      <p className="text-sm text-slate-500 mt-2">
        Vou usar isso pra escolher por onde a sua trilha começa.
      </p>
    </div>

    {/* 2 cards grandes */}
    <div className="max-w-md w-full mx-auto flex flex-col gap-3 flex-1">
      {OPTIONS.map((opt) => {
        const isSelected = selected === opt.value;
        return (
          <motion.button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            whileTap={{ scale: 0.98 }}
            className={`w-full flex items-center gap-4 px-5 py-5 rounded-2xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
              isSelected
                ? "border-indigo-500 bg-indigo-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30"
            }`}
          >
            <span className="text-4xl flex-shrink-0" aria-hidden="true">
              {opt.emoji}
            </span>
            <div className="flex-1 text-left">
              <div className={`text-lg font-bold ${isSelected ? "text-indigo-900" : "text-slate-900"}`}>
                {opt.label}
              </div>
              <div className="text-xs text-slate-500 mt-1">{opt.description}</div>
            </div>
          </motion.button>
        );
      })}
    </div>
  </motion.div>
);
