import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

interface AntecipacaoScreenProps {
  stepLabel: string;
  onContinue: () => void;
}

/**
 * Sub-tela 10/10 do Desafio — Antecipação.
 *
 * Premium redesign: dark cinematic (similar MiniExperienceIntro) pra
 * conferir peso emocional à mensagem final do Desafio.
 *
 * Spec onboarding v2 (linhas 941-985): leitura emocional silenciosa.
 *   - Sem quiz
 *   - 0 pontos
 *   - Pausa de 1 segundo + fade-in animado do CTA
 *   - Headers (Domínio/Hearts) ficam visíveis mas com silent=true
 */
export const AntecipacaoScreen = ({
  stepLabel,
  onContinue,
}: AntecipacaoScreenProps) => {
  const [mounted, setMounted] = useState(false);
  const [showCta, setShowCta] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setMounted(true), 50);
    // Pausa antes de revelar o CTA (compactado pra caber em viewport mobile)
    const t2 = setTimeout(() => setShowCta(true), 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen flex flex-col px-6 pt-24 pb-6 relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950"
    >
      {/* Glow orbs decorativos */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.8 }}
        className="absolute top-1/3 -left-24 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl"
        aria-hidden="true"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.8, delay: 0.3 }}
        className="absolute bottom-1/4 -right-24 w-96 h-96 rounded-full bg-violet-500/20 blur-3xl"
        aria-hidden="true"
      />

      {/* Grid sutil */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-md w-full mx-auto flex flex-col flex-1">
        {/* Step label */}
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-4 text-center">
          {stepLabel}
        </p>

        {/* Conteúdo principal — stagger reveal compactado */}
        <div className="flex-1 flex flex-col justify-center gap-4 text-white/85">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 8 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="flex items-center justify-center gap-2 text-white/50 text-[11px] uppercase tracking-[0.18em] font-bold"
          >
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              aria-hidden="true"
            >
              ⏳
            </motion.span>
            Respira fundo
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 10 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-xl sm:text-2xl font-black text-white text-center leading-tight tracking-tight"
          >
            Imagina você daqui{" "}
            <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
              28 dias
            </span>
            .
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 10 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="text-center text-sm sm:text-base leading-snug"
          >
            Quando alguém perguntar:{" "}
            <span className="italic text-white font-medium block mt-1">
              "Você sabe usar IA?"
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 10 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="text-center text-[13px] sm:text-sm text-white/65 leading-snug"
          >
            Você não vai ter que mentir, se esquivar, sentir aquele aperto de{" "}
            <span className="italic text-white/80">"ainda não..."</span>.
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 10 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="relative mx-auto max-w-sm w-full"
          >
            {/* Glow atrás do quote */}
            <div
              className="absolute -inset-3 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 blur-2xl rounded-3xl"
              aria-hidden="true"
            />
            <blockquote className="relative rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 text-center">
              <p className="text-base sm:text-lg font-black text-white leading-tight">
                "Sei.{" "}
                <span className="text-sm sm:text-base font-medium text-white/85">
                  E uso pra dominar meu trabalho, meus projetos, minha vida."
                </span>
              </p>
            </blockquote>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 8 }}
            transition={{ delay: 1.15, duration: 0.5 }}
            className="text-center text-xs sm:text-sm text-white/60 leading-snug"
          >
            A diferença entre quem responde isso e quem evita a pergunta{" "}
            <span className="font-black bg-gradient-to-r from-amber-300 to-amber-400 bg-clip-text text-transparent">
              começou aqui. Agora.
            </span>
          </motion.p>
        </div>

        {/* CTA — fade-in pausado 1s */}
        <AnimatePresence>
          {showCta && (
            <motion.button
              type="button"
              onClick={onContinue}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.02 }}
              className="group relative mt-5 w-full px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 bg-[length:200%_100%] text-white text-base font-black shadow-[0_15px_50px_-10px_rgba(99,102,241,0.6)] hover:bg-[position:100%_0] transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 overflow-hidden"
            >
              <span
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
                aria-hidden="true"
              />
              <span className="relative flex items-center justify-center gap-2 tracking-wide">
                Continuar
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
};
