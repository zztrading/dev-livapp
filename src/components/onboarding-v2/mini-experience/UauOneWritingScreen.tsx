/**
 * Tela 5 (UAU 1) — variante Escrita.
 * Mostra email "ok" → botão Reescrever → animação typewriter →
 * versão profissional aparece. Custo $0 — texto hardcoded.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import confetti from "canvas-confetti";

interface UauOneWritingScreenProps {
  stepLabel: string;
  onComplete: () => Promise<void>;
}

const EMAIL_BEFORE =
  '"oi, vc pode me passar o doc que falamos? preciso pra amanha"';

const EMAIL_AFTER =
  "Olá, tudo bem?\n\nConforme conversamos ontem, você consegue me enviar o documento até amanhã às 18h?\n\nPreciso pra fechar a entrega desta semana.\n\nObrigado!";

type Phase = "ready" | "rewriting" | "result";

export const UauOneWritingScreen = ({
  stepLabel,
  onComplete,
}: UauOneWritingScreenProps) => {
  const [phase, setPhase] = useState<Phase>("ready");
  const [typedText, setTypedText] = useState("");
  const [continuing, setContinuing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rewriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTypewriter = useCallback(() => {
    setTypedText("");
    let i = 0;
    intervalRef.current = setInterval(() => {
      i++;
      if (i > EMAIL_AFTER.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.55 },
          colors: ["#6366f1", "#8b5cf6", "#10b981", "#fbbf24"],
          scalar: 0.8,
        });
        return;
      }
      setTypedText(EMAIL_AFTER.slice(0, i));
    }, 22);
  }, []);

  // Cleanup de timers em unmount (fix #10)
  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (rewriteTimerRef.current) clearTimeout(rewriteTimerRef.current);
    },
    [],
  );

  const handleRewrite = useCallback(() => {
    setPhase("rewriting");
    rewriteTimerRef.current = setTimeout(() => {
      rewriteTimerRef.current = null;
      setPhase("result");
      startTypewriter();
    }, 700);
  }, [startTypewriter]);

  const handleContinue = useCallback(async () => {
    if (continuing) return;
    setContinuing(true);
    try {
      await onComplete();
    } finally {
      setContinuing(false);
    }
  }, [continuing, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen flex flex-col px-5 sm:px-6 pt-16 pb-10"
    >
      <div className="max-w-md w-full mx-auto flex flex-col flex-1">
        <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">
          {stepLabel}
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug mb-2">
          Olha esse email "ok".
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          A IA refaz pro nível profissional em 3 segundos.
        </p>

        {/* Email ANTES */}
        <div className="mb-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Antes
          </p>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700 italic leading-relaxed">{EMAIL_BEFORE}</p>
          </div>
        </div>

        {/* CTA / Spinner / Resultado */}
        <AnimatePresence mode="wait">
          {phase === "ready" && (
            <motion.button
              key="cta"
              type="button"
              onClick={handleRewrite}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              whileTap={{ scale: 0.97 }}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-base font-bold shadow-lg shadow-indigo-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <Sparkles className="w-5 h-5" />
              Reescrever com IA
            </motion.button>
          )}

          {phase === "rewriting" && (
            <motion.div
              key="rewriting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 py-4 text-slate-600"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              <span className="text-sm">A Liv tá reescrevendo...</span>
            </motion.div>
          )}

          {phase === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4"
            >
              <div>
                <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Depois
                </p>
                <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 min-h-[180px]">
                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                    {typedText}
                    {typedText.length < EMAIL_AFTER.length && (
                      <span className="inline-block w-0.5 h-4 bg-indigo-500 animate-pulse ml-0.5 align-middle" />
                    )}
                  </p>
                </div>
              </div>

              {typedText.length >= EMAIL_AFTER.length && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-3"
                >
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3">
                    <p className="text-sm text-emerald-900 leading-relaxed">
                      <span className="font-bold">✨ Pronto.</span> Email casual → profissional em 3 segundos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleContinue}
                    disabled={continuing}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-base font-bold shadow-lg shadow-indigo-500/25 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                  >
                    Continuar
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
