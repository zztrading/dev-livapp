import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Target, Zap, Trophy } from "lucide-react";
import { LivCornerAvatar } from "../LivCornerAvatar";

interface PromiseScreenProps {
  onContinue: () => void;
  onBack?: () => void;
}

const BULLETS = [
  {
    icon: Target,
    title: "Dominar IA aplicada ao seu trabalho",
    description: "Não teoria — uso prático no que você faz hoje.",
  },
  {
    icon: Zap,
    title: "Ficar até 3x mais rápido",
    description: "Tarefas que levam horas viram minutos. Fonte: BCG, GitHub.",
  },
  {
    icon: Trophy,
    title: "Se destacar onde a maioria ainda não chegou",
    description: "Quem usa IA no trabalho hoje ainda é minoria. Bora ser?",
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

    {/* Headline */}
    <div className="max-w-md w-full mx-auto text-center mb-8">
      <p className="text-sm font-medium text-indigo-600 uppercase tracking-wider mb-3">
        Em 28 dias com a YesLiv
      </p>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
        Você vai conseguir...
      </h1>
    </div>

    {/* Bullets */}
    <div className="max-w-md w-full mx-auto flex flex-col gap-4 flex-1">
      {BULLETS.map((bullet, idx) => (
        <motion.div
          key={bullet.title}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 + idx * 0.12, duration: 0.35 }}
          className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
            <bullet.icon className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-slate-900 leading-snug">
              {bullet.title}
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {bullet.description}
            </p>
          </div>
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
        Continuar
        <ArrowRight className="w-5 h-5" />
      </motion.button>
    </div>
  </motion.div>
);
