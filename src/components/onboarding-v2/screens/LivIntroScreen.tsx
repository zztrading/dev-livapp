import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface LivIntroScreenProps {
  onContinue: () => void;
}

export const LivIntroScreen = ({ onContinue }: LivIntroScreenProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen flex flex-col items-center justify-center px-6 py-10"
    >
      <div className="max-w-sm w-full flex flex-col items-center text-center gap-6">
        {/* Balão da Liv (apresentação) — acima, pra Liv apontar pra ele */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="relative rounded-2xl bg-white border border-indigo-200 shadow-md shadow-indigo-500/10 px-5 py-4"
        >
          <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
            Oi! Sou a <span className="font-bold text-indigo-600">LIV</span>. Vou te ajudar a dominar IA.
            <br />
            <span className="text-slate-600">Vamos personalizar sua jornada?</span>
          </p>
          {/* Tail apontando pra baixo (em direção à Liv) */}
          <span
            aria-hidden="true"
            className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 rotate-45 w-3 h-3 bg-white border-r border-b border-indigo-200"
          />
        </motion.div>

        {/* LIV em vídeo (grande, centralizada, apontando pro balão) */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5, type: "spring", stiffness: 150 }}
          className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-full overflow-hidden border-[3px] border-white bg-gradient-to-br from-indigo-100 to-violet-100 shadow-[0_20px_50px_-12px_rgba(99,102,241,0.4)]"
        >
          <motion.span
            aria-hidden="true"
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: [0, 0.5, 0], scale: [1, 1.3, 1.5] }}
            transition={{ delay: 0.5, duration: 1.6, ease: "easeOut" }}
            className="absolute inset-0 rounded-full bg-indigo-500/40 blur-2xl"
          />
          <video
            src="/liv-escolhe.mp4"
            poster="/liv-escolhe-poster.jpg"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            className="relative w-full h-full object-cover rounded-full"
          />
        </motion.div>

        {/* CTA Continuar */}
        <motion.button
          type="button"
          onClick={onContinue}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.35 }}
          whileTap={{ scale: 0.97 }}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-base font-bold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Continuar
          <ArrowRight className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  );
};
