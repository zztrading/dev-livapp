/**
 * Tela 11 do flow externo — Reveal final do Mini-experiência.
 *
 * Recebe { score, level } do MiniExperienceFlow.complete() via prop.
 * Mostra:
 *   - LIV comemorando (vídeo liv-clap.mp4)
 *   - Barra "Domínio IA: X/100" cheia
 *   - Mensagem da faixa (iniciante → perfeito)
 *   - 3 stats: +20 XP / 🔥1 dia / 💎+5 sparks
 *   - Confete em 3 ondas (Tier 4 festim)
 *   - Brilho dourado se level >= avançado
 *   - Botão Continuar → Tela 12 (signup_deferred)
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Zap, Flame, Gem, Brain } from "lucide-react";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import type { DominioLevel } from "@/components/onboarding-v2/mini-experience/useMiniExperience";

interface RevealScreenProps {
  /** Resultado do mini-experience: score 0-130, level por faixa.
   *  Se undefined (refresh perdeu state), busca do DB via sessionId. */
  dominioScore?: number;
  dominioLevel?: DominioLevel;
  sessionId?: string | null;
  onContinue: () => void;
}

const LEVEL_CONFIG: Record<
  DominioLevel,
  { emoji: string; title: string; tagline: string; isPro: boolean }
> = {
  iniciante: {
    emoji: "🌱",
    title: "Você tá começando",
    tagline: "Perfeito pra entrar no YesLiv.",
    isPro: false,
  },
  curioso: {
    emoji: "🌿",
    title: "Você tem boa base",
    tagline: "Bora afiar.",
    isPro: false,
  },
  intermediario: {
    emoji: "🌳",
    title: "Top. Você já saca de IA",
    tagline: "Bora te levar pro próximo nível.",
    isPro: true,
  },
  avancado: {
    emoji: "🏔️",
    title: "Você manda muito bem",
    tagline: "99% dos usuários nunca chega aqui.",
    isPro: true,
  },
  perfeito: {
    emoji: "🏔️🔥",
    title: "PERFEITO",
    tagline: "Você cobriu o pacote inteiro. Bem-vinda ao topo.",
    isPro: true,
  },
};

const STAT_CONFETTI_COLORS = ["#6366f1", "#8b5cf6", "#10b981", "#fbbf24", "#f59e0b"];

export const RevealScreen = ({
  dominioScore: propScore,
  dominioLevel: propLevel,
  sessionId,
  onContinue,
}: RevealScreenProps) => {
  // Fallback: se props vieram undefined (refresh), busca do DB
  const [dbScore, setDbScore] = useState<number | null>(null);
  const [dbLevel, setDbLevel] = useState<DominioLevel | null>(null);
  const [loadingFallback, setLoadingFallback] = useState(
    propScore === undefined && !!sessionId,
  );

  useEffect(() => {
    if (propScore !== undefined || !sessionId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("onboarding_v2_mini_experience")
        .select("dominio_score, dominio_level")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setDbScore(data.dominio_score);
        setDbLevel(data.dominio_level as DominioLevel | null);
      }
      setLoadingFallback(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [propScore, sessionId]);

  const fired = useRef(false);
  const dominioScore = propScore ?? dbScore ?? 0;
  const dominioLevel = propLevel ?? dbLevel ?? "iniciante";
  const config = LEVEL_CONFIG[dominioLevel] ?? LEVEL_CONFIG.iniciante;
  const visualScore = Math.min(dominioScore, 100);
  const bonusOverflow = Math.max(0, dominioScore - 100);

  useEffect(() => {
    if (fired.current || loadingFallback) return;
    fired.current = true;

    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(
      setTimeout(() => {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.5 },
          colors: STAT_CONFETTI_COLORS,
        });
      }, 400),
    );

    timers.push(
      setTimeout(() => {
        confetti({
          particleCount: 80,
          spread: 100,
          origin: { y: 0.4, x: 0.3 },
          colors: STAT_CONFETTI_COLORS,
        });
        confetti({
          particleCount: 80,
          spread: 100,
          origin: { y: 0.4, x: 0.7 },
          colors: STAT_CONFETTI_COLORS,
        });
      }, 1200),
    );

    if (config.isPro) {
      timers.push(
        setTimeout(() => {
          confetti({
            particleCount: 100,
            spread: 120,
            origin: { y: 0.3 },
            colors: ["#fbbf24", "#f59e0b", "#fcd34d"],
            scalar: 1.1,
          });
        }, 2000),
      );
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [config.isPro, loadingFallback]);

  if (loadingFallback) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen flex flex-col items-center justify-center px-6 py-10"
    >
      <div className="max-w-sm w-full flex flex-col items-center text-center gap-6">
        {/* Liv comemorando */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, delay: 0.15 }}
          className={`relative w-36 h-36 rounded-full overflow-hidden border-[3px] border-white shadow-[0_20px_50px_-12px_rgba(99,102,241,0.5)] ${
            config.isPro ? "ring-4 ring-amber-300/40" : ""
          }`}
        >
          <motion.span
            aria-hidden="true"
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: [0, 0.6, 0], scale: [1, 1.4, 1.7] }}
            transition={{ delay: 0.5, duration: 1.6, ease: "easeOut", repeat: 1 }}
            className={`absolute inset-0 rounded-full blur-2xl ${
              config.isPro ? "bg-amber-400/50" : "bg-indigo-500/40"
            }`}
          />
          <video
            src="/liv-clap.mp4"
            poster="/liv-clap-poster.jpg"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            className="relative w-full h-full object-cover rounded-full"
          />
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">
            ✨ Mini-experiência completa
          </p>
          <h1
            className={`text-2xl sm:text-3xl font-bold leading-snug ${
              config.isPro
                ? "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 bg-clip-text text-transparent"
                : "text-slate-900"
            }`}
          >
            {config.emoji} {config.title}
          </h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">{config.tagline}</p>
        </motion.div>

        {/* Barra Domínio IA preenchida */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="w-full flex flex-col gap-2 px-2"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-bold text-slate-500 uppercase tracking-wider">
              <Brain className="w-3.5 h-3.5 text-indigo-500" />
              Domínio IA
            </span>
            <span className="font-bold tabular-nums text-indigo-600">
              {visualScore}
              {bonusOverflow > 0 && (
                <span className="text-amber-500 ml-1">+{bonusOverflow}</span>
              )}
              <span className="text-slate-400 ml-0.5">/100</span>
            </span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${visualScore}%` }}
              transition={{ delay: 0.8, duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
              className={
                bonusOverflow > 0
                  ? "h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-amber-400"
                  : "h-full bg-gradient-to-r from-indigo-500 to-violet-500"
              }
            />
          </div>
        </motion.div>

        {/* 3 stats animados */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.4 }}
          className="grid grid-cols-3 gap-3 w-full"
          role="status"
          aria-live="polite"
          aria-label="Você ganhou 20 XP, 1 dia de streak e 5 cristais"
        >
          <StatCard icon={Zap} value="+20" label="XP" color="text-indigo-500" delay={1.1} />
          <StatCard icon={Flame} value="1" label="Dia" color="text-amber-500" delay={1.25} />
          <StatCard icon={Gem} value="+5" label="Sparks" color="text-violet-500" delay={1.4} />
        </motion.div>

        {/* CTA Continuar */}
        <motion.button
          type="button"
          onClick={onContinue}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6, duration: 0.35 }}
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

interface StatCardProps {
  icon: typeof Zap;
  value: string;
  label: string;
  color: string;
  delay: number;
}

const StatCard = ({ icon: Icon, value, label, color, delay }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 8, scale: 0.85 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ delay, duration: 0.4, type: "spring", stiffness: 220 }}
    className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-border bg-muted/40"
  >
    <Icon className={`w-5 h-5 ${color}`} aria-hidden="true" />
    <span className={`text-xl font-bold tabular-nums ${color}`}>{value}</span>
    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
      {label}
    </span>
  </motion.div>
);
