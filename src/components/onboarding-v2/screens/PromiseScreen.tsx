import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft } from "lucide-react";

interface PromiseScreenProps {
  onContinue: () => void;
  onBack?: () => void;
}

const BULLETS = [
  {
    emoji: "🎯",
    text: "Criar prompts que realmente resolvem problemas, não respostas genéricas",
  },
  {
    emoji: "💼",
    text: "Ganhar horas no trabalho usando IA para escrever, organizar e decidir melhor",
  },
  {
    emoji: "🚀",
    text: "Sair da curiosidade e entrar no grupo de quem já usa IA para crescer",
  },
];

export const PromiseScreen = ({ onContinue, onBack }: PromiseScreenProps) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
    className="min-h-screen flex flex-col px-5 sm:px-6 pt-6 pb-10"
  >
    {/* Header */}
    <div className="flex items-center mb-8 max-w-md w-full mx-auto">
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
    </div>

    {/* Headline */}
    <div className="max-w-md w-full mx-auto text-center mb-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
        Em 28 dias, você começa a usar IA como vantagem — não como ameaça.
      </h1>
    </div>

    {/* Bullets */}
    <div className="max-w-md w-full mx-auto flex flex-col gap-3 flex-1">
      {BULLETS.map((bullet, idx) => (
        <motion.div
          key={bullet.emoji}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 + idx * 0.12, duration: 0.35 }}
          className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100"
        >
          <span
            className="text-2xl flex-shrink-0 leading-none"
            aria-hidden="true"
          >
            {bullet.emoji}
          </span>
          <p className="flex-1 text-base font-semibold text-slate-900 leading-snug">
            {bullet.text}
          </p>
        </motion.div>
      ))}
    </div>

    {/* CTA */}
    <div className="max-w-md w-full mx-auto pt-6">
      <motion.button
        type="button"
        onClick={onContinue}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.3 }}
        whileTap={{ scale: 0.97 }}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-base font-bold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        Começar minha virada com IA
        <ArrowRight className="w-5 h-5" />
      </motion.button>
    </div>
  </motion.div>
);
