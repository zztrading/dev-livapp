import { motion } from "framer-motion";
import { BookOpen, Headphones, ArrowLeft, Sparkles } from "lucide-react";
import { useV7SoundEffects } from "@/components/lessons/v7/cinematic/useV7SoundEffects";
import { LivBubbleVideo } from "./LivBubbleVideo";

interface V8ModeSelectorProps {
  onSelectMode: (mode: "read" | "listen") => void;
  onBack?: () => void;
  title?: string;
}

const modes = [
  {
    id: "read" as const,
    icon: BookOpen,
    label: "Ler",
    description: "No seu ritmo • Áudio opcional",
    recommended: false,
  },
  {
    id: "listen" as const,
    icon: Headphones,
    label: "Ouvir",
    description: "Mãos livres • Aula narrada",
    recommended: true,
  },
];

export const V8ModeSelector = ({ onSelectMode, onBack, title }: V8ModeSelectorProps) => {
  const { unlockAudio } = useV7SoundEffects(0.5, true);

  const handleSelectMode = (mode: "read" | "listen") => {
    unlockAudio();
    onSelectMode(mode);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex flex-col items-center justify-center min-h-[70vh] px-6 gap-10"
    >
      {/* Back button */}
      {onBack && (
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          onClick={onBack}
          className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </motion.button>
      )}

      {/* Title */}
      <div className="text-center space-y-2">
        {title && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-sm text-indigo-500 font-medium"
          >
            {title}
          </motion.p>
        )}
        <motion.h2
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl sm:text-3xl font-bold text-slate-900"
        >
          Como você quer aprender?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-sm text-slate-500"
        >
          Escolha o modo que melhor combina com você
        </motion.p>
      </div>

      {/* Mode cards — mobile: stacked horizontal | sm+: 2-col vertical */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full max-w-sm">
        {modes.map((mode, i) => (
          <motion.button
            key={mode.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.12 }}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleSelectMode(mode.id)}
            className="group relative flex flex-row sm:flex-col items-center gap-4 sm:gap-3 p-4 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-sm transition-all overflow-hidden hover:border-indigo-500/40 hover:shadow-[0_10px_30px_-12px_rgba(99,102,241,0.35)]"
            aria-label={`Modo ${mode.label}: ${mode.description}${mode.recommended ? " (recomendado)" : ""}`}
          >
            {/* Hover gradient overlay */}
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-violet-500/0 group-hover:from-indigo-500/[0.06] group-hover:to-violet-500/[0.08] transition-colors"
            />

            {/* Recommended badge */}
            {mode.recommended && (
              <span className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-[10px] font-semibold text-white shadow-sm">
                <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />
                Recomendado
              </span>
            )}

            <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 group-hover:from-indigo-500/25 group-hover:to-violet-500/25 transition-colors">
              <mode.icon className="w-6 h-6 text-indigo-500" />
            </div>

            <div className="relative flex flex-col items-start sm:items-center gap-1 text-left sm:text-center">
              <span className="text-base font-semibold text-slate-900">
                {mode.label}
              </span>
              <span className="text-xs text-slate-500 leading-snug">
                {mode.description}
              </span>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Liv em bubble flutuante — balões em loop até o usuário escolher o modo */}
      <LivBubbleVideo
        videoSrc="/liv-escolhe.mp4"
        posterSrc="/liv-escolhe-poster.jpg"
        loop
        messages={[
          { text: "Como quer aprender?", duration: 2800 },
          { text: "Bora de Ouvir?", duration: 2800 },
          { text: "Você que escolhe.", duration: 2600 },
          { text: "Ouvir, ouvir, ouvir... brincadeira!", duration: 3400 },
        ]}
      />
    </motion.div>
  );
};
