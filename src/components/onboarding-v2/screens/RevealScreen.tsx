/**
 * Tela 11 do Onboarding V2 — Reveal Orgânico (FASE 3).
 *
 * Premium redesign: hero gigante com Liv halo, score bar dramática,
 * cards de rewards elegantes com glow, mensagem condicional por path.
 *
 * Spec onboarding v2 (linhas 998-1042).
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Zap, Flame, Sparkles, Heart, Award, Brain } from "lucide-react";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import type { DominioLevel } from "@/components/onboarding-v2/mini-experience/useMiniExperience";

interface RevealScreenProps {
  dominioScore?: number;
  dominioLevel?: DominioLevel;
  sessionId?: string | null;
  onContinue: () => void;
}

const LEVEL_CONFIG: Record<
  DominioLevel,
  { emoji: string; tagline: string; isPro: boolean; accentText: string; accentBg: string }
> = {
  iniciante: {
    emoji: "🌱",
    tagline:
      "Onde você tá: começando. Onde você vai chegar: depende do quanto vai querer. O YesLiv tá feito pra esse caminho.",
    isPro: false,
    accentText: "text-emerald-600",
    accentBg: "from-emerald-500 to-green-500",
  },
  curioso: {
    emoji: "🌿",
    tagline: "Você tem base. Vamos afiar.",
    isPro: false,
    accentText: "text-cyan-600",
    accentBg: "from-cyan-500 to-blue-500",
  },
  intermediario: {
    emoji: "🌳",
    tagline: "Top. Você já saca de IA. Vamos pro próximo nível.",
    isPro: true,
    accentText: "text-violet-600",
    accentBg: "from-violet-500 to-indigo-500",
  },
  avancado: {
    emoji: "🏔️",
    tagline: "99% dos usuários de IA nunca chega aqui. Bem-vindo ao topo.",
    isPro: true,
    accentText: "text-amber-600",
    accentBg: "from-amber-500 via-orange-500 to-red-500",
  },
};

const PATH_CHOICE_MESSAGES: Record<string, string> = {
  zero: "Você escolheu começar do zero — sua trilha começa na Aula 1 (Fundamentos da IA).",
  placement: "Baseado no seu Domínio IA, vamos te recomendar por onde começar.",
};

const STAT_CONFETTI_COLORS = ["#6366f1", "#8b5cf6", "#10b981", "#fbbf24", "#f59e0b"];

const REVEAL_XP_INITIAL = 20;
const REVEAL_STREAK_INITIAL = 1;
const REVEAL_PATENTE_LABEL = "Novato Nv 1";

interface RevealData {
  sparks: number;
  hearts: number;
  pathChoice: string | null;
}

export const RevealScreen = ({
  dominioScore: propScore,
  dominioLevel: propLevel,
  sessionId,
  onContinue,
}: RevealScreenProps) => {
  const [dbScore, setDbScore] = useState<number | null>(null);
  const [dbLevel, setDbLevel] = useState<DominioLevel | null>(null);
  const [revealData, setRevealData] = useState<RevealData>({
    sparks: 0,
    hearts: 5,
    pathChoice: null,
  });
  const [loadingFallback, setLoadingFallback] = useState(!!sessionId);

  // Liv toca a animação UMA vez, completa, depois fade-out estrela (não loop)
  const livVideoRef = useRef<HTMLVideoElement | null>(null);
  const [livEnded, setLivEnded] = useState(false);
  const livEndedRef = useRef(false);

  const handleLivEnded = () => {
    if (livEndedRef.current) return; // idempotente — não dispara estrelas 2x
    livEndedRef.current = true;
    // Pause defensivo — garante que não tenta replay se algo dispara play()
    if (livVideoRef.current) {
      try {
        livVideoRef.current.pause();
      } catch {
        /* ignore */
      }
    }
    // Burst de estrelas onde a Liv estava (top-center)
    confetti({
      particleCount: 35,
      spread: 360,
      origin: { y: 0.28, x: 0.5 },
      shapes: ["star"],
      colors: ["#fbbf24", "#f59e0b", "#fcd34d", "#fef3c7", "#ffffff"],
      startVelocity: 22,
      scalar: 1.2,
      gravity: 0.4,
      ticks: 100,
    });
    // Pequeno delay pra estrelas começarem antes do fade
    setTimeout(() => setLivEnded(true), 120);
  };

  useEffect(() => {
    if (!sessionId) {
      setLoadingFallback(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [miniRes, sessionRes] = await Promise.all([
        supabase
          .from("onboarding_v2_mini_experience")
          .select(
            "dominio_score, dominio_level, mistake_review_sparks, hearts_lost_in_desafio, mistake_review_recovered",
          )
          .eq("session_id", sessionId)
          .maybeSingle(),
        supabase
          .from("onboarding_v2_sessions")
          .select("path_choice")
          .eq("session_id", sessionId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (miniRes.data) {
        const hearts = Math.max(
          0,
          Math.min(
            5,
            5 -
              (miniRes.data.hearts_lost_in_desafio ?? 0) +
              (miniRes.data.mistake_review_recovered ?? 0),
          ),
        );
        if (propScore === undefined) {
          setDbScore(miniRes.data.dominio_score);
          setDbLevel(miniRes.data.dominio_level as DominioLevel | null);
        }
        setRevealData({
          sparks: miniRes.data.mistake_review_sparks ?? 0,
          hearts,
          pathChoice: sessionRes.data?.path_choice ?? null,
        });
      }
      setLoadingFallback(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [propScore, sessionId]);

  const fired = useRef(false);
  const dominioScore = Math.min(propScore ?? dbScore ?? 0, 100);
  const dominioLevel = propLevel ?? dbLevel ?? "iniciante";
  const config = LEVEL_CONFIG[dominioLevel] ?? LEVEL_CONFIG.iniciante;

  useEffect(() => {
    if (fired.current || loadingFallback) return;
    fired.current = true;

    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(
      setTimeout(() => {
        confetti({
          particleCount: 140,
          spread: 90,
          origin: { y: 0.5 },
          colors: STAT_CONFETTI_COLORS,
          startVelocity: 40,
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
            particleCount: 120,
            spread: 130,
            origin: { y: 0.3 },
            colors: ["#fbbf24", "#f59e0b", "#fcd34d"],
            scalar: 1.2,
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-white">
        <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex flex-col items-center px-5 sm:px-6 pt-10 pb-10 relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-indigo-50/30"
    >
      {/* Glow orbs decorativos */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 0.4, scale: 1 }}
        transition={{ duration: 1.5 }}
        className={`absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-3xl bg-gradient-to-b ${config.accentBg} opacity-20`}
        aria-hidden="true"
      />

      <div className="relative max-w-md w-full flex flex-col items-center gap-6">
        {/* Liv com halo dramático — toca uma vez, depois fade-out estrela */}
        <AnimatePresence>
          {!livEnded && (
            <motion.div
              key="liv"
              initial={{ scale: 0, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{
                scale: 0.5,
                opacity: 0,
                y: -8,
                filter: "blur(8px)",
                transition: { duration: 0.9, ease: [0.25, 0.1, 0.25, 1] },
              }}
              transition={{ type: "spring", stiffness: 160, damping: 18, delay: 0.15 }}
              className="relative"
            >
              {/* Outer ring glow */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1.1 }}
                transition={{
                  delay: 0.5,
                  duration: 1.2,
                  repeat: Infinity,
                  repeatType: "reverse",
                }}
                className={`absolute -inset-3 rounded-full blur-2xl bg-gradient-to-br ${config.accentBg} opacity-40`}
                aria-hidden="true"
              />

              <div
                className={`relative w-32 h-32 sm:w-36 sm:h-36 rounded-full overflow-hidden border-[3px] border-white shadow-[0_25px_60px_-15px_rgba(99,102,241,0.5)] ${
                  config.isPro
                    ? "ring-4 ring-amber-300/50 ring-offset-2 ring-offset-transparent"
                    : ""
                }`}
              >
                <video
                  ref={livVideoRef}
                  src="/liv-clap.mp4"
                  poster="/liv-clap-poster.jpg"
                  autoPlay
                  muted
                  playsInline
                  preload="auto"
                  aria-hidden="true"
                  onEnded={handleLivEnded}
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Eyebrow + Headline */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-[0.15em] mb-3">
            <Sparkles className="w-3 h-3" aria-hidden="true" />
            Mini-experiência completa
          </div>
          <h1 className="text-[20px] sm:text-[26px] font-black text-slate-900 leading-[1.2] tracking-tight">
            Você tem o instinto certo. Agora vamos transformar isso em{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent">
              habilidade real
            </span>{" "}
            pra você prosperar na era da IA.
          </h1>
        </motion.div>

        {/* Score bar dramática */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="w-full relative"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Brain className="w-5 h-5 text-indigo-600" strokeWidth={2.5} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">
                Domínio IA
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-3xl font-black tabular-nums ${config.accentText}`}>
                {dominioScore}
              </span>
              <span className="text-sm font-bold text-slate-400 tabular-nums">/100</span>
              <span className="text-2xl ml-1" aria-hidden="true">
                {config.emoji}
              </span>
            </div>
          </div>

          {/* Barra com glow */}
          <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${dominioScore}%` }}
              transition={{ delay: 0.9, duration: 1.4, ease: [0.25, 0.1, 0.25, 1] }}
              className={`h-full bg-gradient-to-r ${config.accentBg} ${
                config.isPro
                  ? "shadow-[0_0_20px_rgba(251,146,60,0.7)]"
                  : "shadow-[0_0_12px_rgba(99,102,241,0.5)]"
              }`}
            />
          </div>

          <p className="text-sm text-slate-700 mt-3 leading-relaxed text-center">
            {config.tagline}
          </p>
        </motion.div>

        {/* Cards de rewards — grid premium */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.5 }}
          className="w-full flex flex-col gap-2.5"
          role="status"
          aria-live="polite"
          aria-label={`Você ganhou ${REVEAL_XP_INITIAL} XP, ${revealData.sparks} Sparks, ${revealData.hearts} de 5 Vidas, 1 dia de sequência e patente Novato Nível 1`}
        >
          <RewardCard
            icon={Zap}
            iconBg="bg-indigo-100"
            iconColor="text-indigo-600"
            label="XP iniciais"
            value={`+${REVEAL_XP_INITIAL}`}
            valueColor="text-indigo-600"
            delay={1.1}
          />
          <RewardCard
            icon={Sparkles}
            iconBg="bg-amber-100"
            iconColor="text-amber-600"
            label="Sparks"
            value={`+${revealData.sparks}`}
            valueColor="text-amber-600"
            delay={1.2}
          />
          <RewardCard
            icon={Heart}
            iconBg="bg-rose-100"
            iconColor="text-rose-600"
            label="Vidas"
            value={`${revealData.hearts}/5`}
            valueColor="text-rose-600"
            delay={1.3}
          />
          <RewardCard
            icon={Flame}
            iconBg="bg-orange-100"
            iconColor="text-orange-600"
            label="Sequência"
            value={`${REVEAL_STREAK_INITIAL} dia`}
            valueColor="text-orange-600"
            delay={1.4}
          />
          <RewardCard
            icon={Award}
            iconBg="bg-violet-100"
            iconColor="text-violet-600"
            label="Patente"
            value={REVEAL_PATENTE_LABEL}
            valueColor="text-violet-600"
            delay={1.5}
            isPatent
          />
        </motion.div>

        {/* Mensagem condicional path_choice */}
        {revealData.pathChoice && PATH_CHOICE_MESSAGES[revealData.pathChoice] && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.7, duration: 0.5 }}
            className="relative w-full rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50/60 border border-indigo-100 overflow-hidden"
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-violet-500"
              aria-hidden="true"
            />
            <p className="text-sm text-slate-700 leading-relaxed pl-4 pr-4 py-3">
              {PATH_CHOICE_MESSAGES[revealData.pathChoice]}
            </p>
          </motion.div>
        )}

        {/* CTA premium */}
        <motion.button
          type="button"
          onClick={onContinue}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.85, duration: 0.5 }}
          whileTap={{ scale: 0.97 }}
          whileHover={{ scale: 1.01 }}
          className="group relative w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-[length:200%_100%] text-white text-base font-black shadow-[0_15px_40px_-10px_rgba(99,102,241,0.6)] hover:bg-[position:100%_0] transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 overflow-hidden"
        >
          <span
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
            aria-hidden="true"
          />
          <span className="relative flex items-center gap-2 tracking-wide">
            Continuar
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </span>
        </motion.button>
      </div>
    </motion.div>
  );
};

interface RewardCardProps {
  icon: typeof Zap;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  valueColor: string;
  delay: number;
  isPatent?: boolean;
}

const RewardCard = ({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  valueColor,
  delay,
  isPatent = false,
}: RewardCardProps) => (
  <motion.div
    initial={{ opacity: 0, x: -16, scale: 0.95 }}
    animate={{ opacity: 1, x: 0, scale: 1 }}
    transition={{ delay, duration: 0.45, type: "spring", stiffness: 180, damping: 18 }}
    className={`relative flex items-center gap-3.5 p-3.5 rounded-2xl border-2 transition-all hover:shadow-md ${
      isPatent
        ? "bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-200"
        : "bg-white border-slate-200"
    }`}
  >
    <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
      <Icon
        className={`w-5 h-5 ${iconColor} ${
          label === "Vidas" ? "fill-rose-500" : label === "Sparks" ? "" : ""
        }`}
        aria-hidden="true"
        strokeWidth={2.5}
      />
    </div>
    <span className="flex-1 text-left text-[14px] font-semibold text-slate-700">{label}</span>
    <span className={`text-lg font-black tabular-nums ${valueColor}`}>{value}</span>
  </motion.div>
);
