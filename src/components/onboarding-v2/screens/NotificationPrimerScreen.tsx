import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Bell, BellRing } from "lucide-react";

interface NotificationPrimerScreenProps {
  onResult: (result: "granted" | "denied" | "dismissed" | "unsupported") => void;
  onBack?: () => void;
}

export const NotificationPrimerScreen = ({
  onResult,
  onBack,
}: NotificationPrimerScreenProps) => {
  const [pending, setPending] = useState(false);

  const handleEnable = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      onResult("unsupported");
      return;
    }
    setPending(true);
    try {
      // Importante: chamado dentro de handler de click — gesto válido pro Chrome
      const result = await Notification.requestPermission();
      if (result === "granted") onResult("granted");
      else if (result === "denied") onResult("denied");
      else onResult("dismissed");
    } catch {
      onResult("dismissed");
    } finally {
      setPending(false);
    }
  };

  const handleSkip = () => onResult("dismissed");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="min-h-screen flex flex-col px-5 sm:px-6 pt-6 pb-10"
    >
      {/* Header só com back */}
      <div className="flex items-center mb-12 max-w-md w-full mx-auto">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-2 -ml-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Texto + LIV apontando + CTA, em ordem visual descendente */}
      <div className="max-w-md w-full mx-auto flex flex-col items-center text-center flex-1 justify-center gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
            Vou te lembrar todo dia
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed max-w-xs mx-auto">
            Aprender IA vira hábito mais fácil com uma cutucadinha diária.
            Sem spam — só na hora certa pra você praticar.
          </p>
        </motion.div>

        {/* LIV apontando pra baixo (em direção ao CTA logo abaixo) */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5, type: "spring", stiffness: 150 }}
          className="relative w-32 h-32 rounded-full overflow-hidden border-[3px] border-white bg-gradient-to-br from-indigo-100 to-violet-100 shadow-[0_15px_35px_-10px_rgba(99,102,241,0.4)]"
        >
          <motion.span
            aria-hidden="true"
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: [0, 0.5, 0], scale: [1, 1.3, 1.5] }}
            transition={{ delay: 0.7, duration: 1.6, ease: "easeOut", repeat: Infinity, repeatDelay: 1.5 }}
            className="absolute inset-0 rounded-full bg-indigo-500/40 blur-2xl"
          />
          <video
            src="/liv-point-down.mp4"
            poster="/liv-point-down-poster.jpg"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            className="relative w-full h-full object-cover rounded-full"
          />
        </motion.div>
      </div>

      {/* CTAs */}
      <div className="max-w-md w-full mx-auto pt-6 flex flex-col gap-2.5">
        <motion.button
          type="button"
          onClick={handleEnable}
          disabled={pending}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.3 }}
          whileTap={!pending ? { scale: 0.97 } : undefined}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-base font-bold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-shadow disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <BellRing className="w-5 h-5" />
          {pending ? "Aguardando permissão..." : "Sim, me lembra todo dia"}
        </motion.button>

        <motion.button
          type="button"
          onClick={handleSkip}
          disabled={pending}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75, duration: 0.3 }}
          className="w-full py-3 rounded-2xl text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Agora não
        </motion.button>
      </div>
    </motion.div>
  );
};
