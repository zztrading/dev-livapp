import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Zap, Coins, Flame, ArrowRight, RotateCcw, Clock, Target } from "lucide-react";
import confetti from "canvas-confetti";
import { registerGamificationEvent } from "@/services/gamification";
import { V8LessonRating } from "./V8LessonRating";
import { V8StreakCelebration } from "./V8StreakCelebration";
import { PASS_SCORE } from "@/constants/v8Rules";
import { updateMissionProgress } from "@/lib/updateMissionProgress";
import { supabase } from "@/integrations/supabase/client";
import { useV7SoundEffects } from "@/components/lessons/v7/cinematic/useV7SoundEffects";

const CONFETTI_PRIMARY = ["#6366f1", "#8b5cf6", "#10b981", "#fbbf24"] as const;
const CONFETTI_LEFT = ["#f59e0b", "#ec4899", "#6366f1"] as const;
const CONFETTI_RIGHT = ["#10b981", "#8b5cf6", "#fbbf24"] as const;

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;
const isStreakMilestone = (n: number) => (STREAK_MILESTONES as readonly number[]).includes(n);

interface V8CompletionScreenProps {
  scores: number[];
  lessonId: string;
  startedAt?: number | null;
  onContinue: () => void;
  onBackToTrail?: () => void;
}

const formatElapsed = (ms: number): string => {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}min ${sec}s`;
};

export const V8CompletionScreen = ({
  scores,
  lessonId,
  startedAt,
  onContinue,
  onBackToTrail,
}: V8CompletionScreenProps) => {
  const [gamificationResult, setGamificationResult] = useState<{
    xpDelta: number;
    coinsDelta: number;
    patentName: string;
    isNewPatent: boolean;
  } | null>(null);
  const [streakDays, setStreakDays] = useState(0);
  const [isFirstLesson, setIsFirstLesson] = useState(false);
  const [showStreakCelebration, setShowStreakCelebration] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const hasRegistered = useRef(false);
  const { playSound } = useV7SoundEffects(0.6, true);

  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 100;

  // Captura o tempo ao montar — congela o display, evita re-render contínuo
  const elapsedLabel = useMemo(() => {
    if (!startedAt) return null;
    return formatElapsed(Date.now() - startedAt);
  }, [startedAt]);

  const correctCount = useMemo(
    () => scores.filter((s) => s >= PASS_SCORE).length,
    [scores]
  );
  const totalAnswered = scores.length;

  // Variante da Liv comemorando — baseada no avgScore
  // • Sem exercícios: clap (parabéns por concluir)
  // • Errou tudo (avgScore === 0): none (mantém troféu padrão)
  // • Acertou em parte (0 < avgScore ≤ 70): thumb (encorajamento)
  // • Foi bem (avgScore > 70): clap (celebração)
  const livVariant = useMemo<"clap" | "thumb" | "none">(() => {
    if (scores.length === 0) return "clap";
    if (avgScore === 0) return "none";
    if (avgScore <= 70) return "thumb";
    return "clap";
  }, [scores.length, avgScore]);

  // Microcopies em loop ao lado da Liv (apenas pras variantes com vídeo)
  const livMessages = useMemo<string[]>(() => {
    if (livVariant === "clap") return ["Boa demais!", "Você arrasou!", "Bora pra próxima?"];
    if (livVariant === "thumb") return ["Tá no caminho!", "Próxima a gente acerta!", "Segue firme."];
    return [];
  }, [livVariant]);

  const [livMsgIdx, setLivMsgIdx] = useState<number | null>(null);

  useEffect(() => {
    if (livMessages.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    const cycle = (startDelay: number) => {
      let cursor = startDelay;
      livMessages.forEach((_, idx) => {
        const showAt = cursor;
        const hideAt = showAt + 2800;
        timers.push(setTimeout(() => !cancelled && setLivMsgIdx(idx), showAt));
        timers.push(setTimeout(() => !cancelled && setLivMsgIdx(null), hideAt));
        cursor = hideAt + 400;
      });
      timers.push(setTimeout(() => !cancelled && cycle(0), cursor));
    };
    cycle(1200);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [livMessages]);

  // Register gamification event + confetti + sound
  useEffect(() => {
    if (hasRegistered.current) return;
    hasRegistered.current = true;

    const register = async () => {
      try {
        const result = await registerGamificationEvent("lesson_completed", lessonId, { avg_score: avgScore });
        if (result) {
          setGamificationResult({
            xpDelta: result.xp_delta ?? 0,
            coinsDelta: result.coins_delta ?? 0,
            patentName: result.patent_name ?? "",
            isNewPatent: result.is_new_patent ?? false,
          });
          if (result.is_new_patent) {
            setTimeout(() => playSound("level-up"), 1200);
          }
        }
      } catch {
        // Silently fail
      }
      try {
        await updateMissionProgress("aulas", 1);
      } catch {
        // Non-blocking
      }
    };

    register();

    if (avgScore > 0) {
      playSound("success");
      setTimeout(() => {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: CONFETTI_PRIMARY });
      }, 400);
      setTimeout(() => {
        confetti({ particleCount: 80, spread: 100, origin: { y: 0.5, x: 0.3 }, colors: CONFETTI_LEFT });
        confetti({ particleCount: 80, spread: 100, origin: { y: 0.5, x: 0.7 }, colors: CONFETTI_RIGHT });
      }, 1200);
    }
  }, [lessonId, avgScore]);

  // Fetch streak + check if first lesson
  useEffect(() => {
    const fetchStreakAndProgress = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [streakRes, progressRes] = await Promise.all([
        supabase.from("user_streaks").select("current_streak").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_progress").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "completed"),
      ]);

      const streak = streakRes.data?.current_streak ?? 0;
      setStreakDays(streak);

      const completedCount = progressRes.count ?? 0;
      if (completedCount <= 1 && streak >= 1) {
        setIsFirstLesson(true);
      }
    };
    fetchStreakAndProgress();
  }, []);

  const xp = gamificationResult?.xpDelta ?? 40;
  const coins = gamificationResult?.coinsDelta ?? 10;

  const handlePlayCountSound = useCallback(() => {
    playSound("count-up", { volume: 0.3 });
  }, [playSound]);

  const handleXpComplete = useCallback(() => {
    playSound("combo-hit", { volume: 0.5 });
  }, [playSound]);

  const handleCoinsComplete = useCallback(() => {
    playSound("combo-hit", { volume: 0.6 });
  }, [playSound]);

  const handleNextLesson = () => {
    if (isFirstLesson && streakDays >= 1) {
      setShowStreakCelebration(true);
    } else {
      setShowRatingModal(true);
    }
  };

  const handleStreakClose = () => {
    setShowStreakCelebration(false);
    setShowRatingModal(true);
  };

  const handleRatingClose = () => {
    setShowRatingModal(false);
    onContinue();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center min-h-[75vh] gap-8 text-center px-4"
      >
        {/* Hero: Liv comemorando em vídeo + balão de fala em loop (à esquerda).
            Variante "none" (avgScore === 0) mantém o troféu sem balão. */}
        <div className="flex items-center justify-center gap-3">
          {/* Speech bubble (esquerda) — só aparece nas variantes clap/thumb */}
          <AnimatePresence mode="wait">
            {livMsgIdx !== null && livMessages[livMsgIdx] && (
              <motion.div
                key={livMsgIdx}
                initial={{ opacity: 0, x: 16, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 16, scale: 0.95 }}
                transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
                role="status"
                aria-live="polite"
                className="relative max-w-[180px] sm:max-w-[220px] rounded-2xl bg-white border border-indigo-200 shadow-lg shadow-indigo-500/10 px-4 py-2.5"
              >
                <p className="text-sm leading-snug text-slate-700">{livMessages[livMsgIdx]}</p>
                <span
                  aria-hidden="true"
                  className="absolute -right-[7px] top-1/2 -translate-y-1/2 rotate-45 w-3 h-3 bg-white border-r border-t border-indigo-200"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="relative w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-indigo-100 to-violet-100 border border-indigo-200 flex items-center justify-center flex-shrink-0"
          >
            <motion.span
              aria-hidden="true"
              initial={{ opacity: 0, scale: 1 }}
              animate={{ opacity: [0, 0.6, 0], scale: [1, 1.35, 1.6] }}
              transition={{ delay: 0.5, duration: 1.4, ease: "easeOut" }}
              className="absolute inset-0 rounded-full bg-indigo-500/40 blur-xl"
            />
            {livVariant === "none" ? (
              <Trophy className="relative w-10 h-10 text-indigo-500" />
            ) : (
              <video
                key={livVariant}
                src={`/liv-${livVariant}.mp4`}
                poster={`/liv-${livVariant}-poster.jpg`}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                aria-hidden="true"
                className="relative w-full h-full object-cover rounded-full"
              />
            )}
          </motion.div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold text-foreground"
          >
            Aula Concluída!
          </motion.h2>
          {avgScore > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-muted-foreground text-sm"
            >
              Score médio: {avgScore}%
            </motion.p>
          )}
        </div>

        {/* Tempo gasto + Acertos (Sprint #G3 B1+B2) */}
        {(elapsedLabel || totalAnswered > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="flex flex-wrap items-center justify-center gap-2"
          >
            {elapsedLabel && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200">
                <Clock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                <span className="text-xs font-medium text-slate-700 tabular-nums">
                  Tempo: {elapsedLabel}
                </span>
              </div>
            )}
            {totalAnswered > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                <Target className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                <span className="text-xs font-medium text-emerald-700 tabular-nums">
                  Acertos: {correctCount} de {totalAnswered}
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* Stats grid — aria-live announces gains for screen readers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          role="status"
          aria-live="polite"
          aria-label={`Você ganhou ${xp} XP, ${coins} moedas e está em ${streakDays} dia${streakDays === 1 ? "" : "s"} de streak`}
          className="grid grid-cols-3 gap-3 w-full max-w-sm"
        >
          <div className="flex flex-col items-center gap-1.5 p-4 rounded-xl border border-border bg-muted/50">
            <Zap className="w-5 h-5 text-indigo-500" aria-hidden="true" />
            <CountUp value={xp} delay={600} onTick={handlePlayCountSound} onComplete={handleXpComplete} />
            <span className="text-[11px] text-muted-foreground font-medium">XP</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 p-4 rounded-xl border border-border bg-muted/50">
            <Coins className="w-5 h-5 text-amber-500" aria-hidden="true" />
            <CountUp value={coins} delay={800} onTick={handlePlayCountSound} onComplete={handleCoinsComplete} />
            <span className="text-[11px] text-muted-foreground font-medium">Moedas</span>
          </div>
          <div
            className={`relative flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-colors ${
              isStreakMilestone(streakDays)
                ? "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50"
                : "border-border bg-muted/50"
            }`}
          >
            {isStreakMilestone(streakDays) && (
              <motion.span
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.5, 0] }}
                transition={{ delay: 1.0, duration: 1.6, ease: "easeOut" }}
                className="absolute inset-0 rounded-xl bg-amber-400/40 blur-lg"
              />
            )}
            <Flame
              className={`relative w-5 h-5 ${isStreakMilestone(streakDays) ? "text-amber-500" : "text-emerald-500"}`}
              aria-hidden="true"
            />
            <span
              className={`relative text-xl font-bold tabular-nums ${
                isStreakMilestone(streakDays) ? "text-amber-700" : "text-foreground"
              }`}
            >
              {streakDays}
            </span>
            <span className="relative text-[11px] text-muted-foreground font-medium">Dias</span>
          </div>
        </motion.div>

        {/* New patent badge */}
        {gamificationResult?.isNewPatent && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.2, type: "spring" }}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-indigo-100 to-violet-100 border border-indigo-200"
          >
            <span className="text-sm font-semibold text-indigo-600">
              🎖️ Nova patente: {gamificationResult.patentName}
            </span>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex flex-col gap-3 w-full max-w-xs"
        >
          <button
            onClick={handleNextLesson}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            Próxima Aula <ArrowRight className="w-4 h-4" />
          </button>

          {onBackToTrail && (
            <button
              onClick={onBackToTrail}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <RotateCcw className="w-4 h-4" /> Voltar à Trilha
            </button>
          )}
        </motion.div>
      </motion.div>

      {/* Streak Celebration Modal */}
      <V8StreakCelebration
        streakDays={streakDays}
        open={showStreakCelebration}
        onClose={handleStreakClose}
      />

      {/* Rating Modal */}
      {showRatingModal && (
        <V8LessonRating
          lessonId={lessonId}
          open={showRatingModal}
          onClose={handleRatingClose}
        />
      )}
    </>
  );
};

// --- CountUp micro-component ---
const CountUp = ({
  value,
  delay = 0,
  onTick,
  onComplete,
}: {
  value: number;
  delay?: number;
  onTick?: () => void;
  onComplete?: () => void;
}) => {
  const [display, setDisplay] = useState(0);
  const tickCounter = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      let frame = 0;
      const totalFrames = 30;
      const step = value / totalFrames;
      tickCounter.current = 0;

      const interval = setInterval(() => {
        frame++;
        setDisplay(Math.min(Math.round(step * frame), value));
        tickCounter.current++;
        if (onTick && tickCounter.current % 5 === 0) {
          onTick();
        }
        if (frame >= totalFrames) {
          clearInterval(interval);
          onComplete?.();
        }
      }, 25);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return (
    <span className="text-xl font-bold text-foreground tabular-nums">+{display}</span>
  );
};
