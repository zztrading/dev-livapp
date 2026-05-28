import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Brain, Heart, Sparkles } from "lucide-react";

interface MiniExperienceIntroProps {
  onContinue: () => void;
}

/**
 * Tela de transição entre Choose Path (Tela 9) e o Desafio (Tela 10).
 *
 * Spec não cobre — mas spec era frio: aluno escolhia path e caía
 * direto na sub-tela 1 do Desafio. Adicionada essa tela pra "preparar"
 * emocionalmente, criar hype, soltar dopamina.
 *
 * Design: cinematic dark, stats preview, CTA dramático, animações stagger.
 *
 * Mostrada apenas na entrada inicial do mini_experience (controle via
 * sessionStorage no MiniExperienceFlow). Refresh não traz de volta.
 */
export const MiniExperienceIntro = ({ onContinue }: MiniExperienceIntroProps) => {
  const [submitting, setSubmitting] = useState(false);

  // Mount animation — pulse de chegada
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleStart = () => {
    if (submitting) return;
    setSubmitting(true);
    // Transição visual de saída antes do continue
    setTimeout(onContinue, 200);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: submitting ? 0 : 1 }}
      transition={{ duration: submitting ? 0.2 : 0.5 }}
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-6 py-12"
    >
      {/* Glow orbs decorativos no background */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2 }}
        className="absolute top-1/4 -left-20 w-80 h-80 rounded-full bg-indigo-500/20 blur-3xl"
        aria-hidden="true"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, delay: 0.2 }}
        className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full bg-violet-500/20 blur-3xl"
        aria-hidden="true"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.4 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.15),transparent_60%)]"
        aria-hidden="true"
      />

      {/* Grid decorativo sutil */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
        aria-hidden="true"
      />

      {/* Conteúdo principal */}
      <div className="relative max-w-md w-full mx-auto flex flex-col items-center text-center">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : -8 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 mb-7"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/90">
            Desafio Liv
          </span>
        </motion.div>

        {/* Headline gigante */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 12 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="text-4xl sm:text-5xl font-black text-white leading-[1.05] tracking-tight mb-3"
        >
          Antes de começar,
          <br />
          <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-amber-300 bg-clip-text text-transparent">
            vamos entender onde você está.
          </span>
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 8 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="text-base sm:text-lg text-white/70 leading-relaxed max-w-sm mb-10"
        >
          A Liv identifica seu nível com I.A. e ajusta a experiência pra você
          aprender no ritmo certo — sem pressão e sem complicação. É rápido e
          divertido!
        </motion.p>

        {/* Stats preview — o que vai aparecer no header do Desafio */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 12 }}
          transition={{ delay: 0.75, duration: 0.5 }}
          className="grid grid-cols-2 gap-3 w-full mb-10"
        >
          <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 px-4 py-4 text-left">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-indigo-300" aria-hidden="true" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                Domínio IA
              </span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-bold text-white tabular-nums">0</span>
              <span className="text-sm text-white/40 tabular-nums mb-0.5">/100</span>
            </div>
            <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full w-0 bg-gradient-to-r from-indigo-400 to-violet-400" />
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 px-4 py-4 text-left">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-rose-400 fill-rose-400" aria-hidden="true" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                Vidas
              </span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-bold text-white tabular-nums">5</span>
              <span className="text-sm text-white/40 tabular-nums mb-0.5">/5</span>
            </div>
            <div className="mt-2 flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Heart
                  key={i}
                  className="w-3 h-3 text-rose-400 fill-rose-400"
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        </motion.div>

        {/* CTA dramático */}
        <motion.button
          type="button"
          onClick={handleStart}
          disabled={submitting}
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{
            opacity: mounted ? 1 : 0,
            y: mounted ? 0 : 16,
            scale: mounted ? 1 : 0.95,
          }}
          transition={{ delay: 0.95, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          whileTap={!submitting ? { scale: 0.97 } : undefined}
          whileHover={!submitting ? { scale: 1.02 } : undefined}
          className="group relative w-full px-8 py-5 rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 bg-[length:200%_100%] text-white text-lg font-black shadow-[0_15px_50px_-10px_rgba(99,102,241,0.6)] hover:bg-[position:100%_0] transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-60 overflow-hidden"
        >
          {/* Shimmer effect */}
          <span
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
            aria-hidden="true"
          />
          <span className="relative inline-flex items-center justify-center gap-3 tracking-wide">
            Começar agora
            <ArrowRight className="w-6 h-6 transition-transform group-hover:translate-x-1" />
          </span>
        </motion.button>

        {/* Microcopy */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: mounted ? 1 : 0 }}
          transition={{ delay: 1.15, duration: 0.4 }}
          className="text-xs text-white/40 mt-5"
        >
          Leva 2-3 minutos · Pode pausar quando quiser
        </motion.p>
      </div>
    </motion.div>
  );
};
