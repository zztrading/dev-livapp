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
          colors: ["#6D28D9", "#8B5CF6", "#10b981", "#fbbf24"],
          scalar: 0.8,
        });
        return;
      }
      setTypedText(EMAIL_AFTER.slice(0, i));
    }, 22);
  }, []);

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

  const finalReady = typedText.length >= EMAIL_AFTER.length;

  return (
    <div className="min-h-screen flex flex-col bg-white pt-24">
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-32 max-w-md w-full mx-auto flex flex-col gap-3.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-violet-700">
          {stepLabel}
        </span>

        <h1 className="text-[20px] sm:text-[23px] font-bold leading-[1.28] tracking-[-0.025em] text-zinc-950">
          <span className="block text-[14.5px] sm:text-[15.5px] font-normal text-zinc-700 leading-[1.5] mb-2 tracking-[-0.005em]">
            Olha esse email "ok".
          </span>
          A IA refaz pro nível profissional em 3 segundos.
        </h1>

        {/* Email ANTES */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">
            Antes
          </p>
          <div className="rounded-[14px] border border-zinc-200 bg-zinc-50 p-3.5">
            <p className="text-[13.5px] text-zinc-700 italic leading-[1.5]">
              {EMAIL_BEFORE}
            </p>
          </div>
        </div>

        {/* Reescrever / Spinner / Resultado */}
        <AnimatePresence mode="wait">
          {phase === "ready" && (
            <motion.button
              key="cta-rewrite"
              type="button"
              onClick={handleRewrite}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              whileTap={{ scale: 0.99 }}
              className="w-full flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 rounded-[14px] bg-zinc-950 text-white text-[14px] font-semibold tracking-[-0.005em] hover:bg-zinc-800 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            >
              <Sparkles className="w-4 h-4" />
              Reescrever com IA
            </motion.button>
          )}

          {phase === "rewriting" && (
            <motion.div
              key="rewriting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 py-4 text-zinc-600"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="w-4 h-4 animate-spin text-violet-700" />
              <span className="text-[13px]">A Liv tá reescrevendo…</span>
            </motion.div>
          )}

          {phase === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-3"
            >
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Depois
                </p>
                <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-3.5 min-h-[170px]">
                  <p className="text-[13.5px] text-zinc-800 leading-[1.55] whitespace-pre-wrap font-medium">
                    {typedText}
                    {!finalReady && (
                      <span className="inline-block w-0.5 h-3.5 bg-violet-700 animate-pulse ml-0.5 align-middle" />
                    )}
                  </p>
                </div>
              </div>

              {finalReady && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.26 }}
                  className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-50 text-emerald-900 text-[12.5px] leading-[1.5]"
                  role="status"
                  aria-live="polite"
                >
                  <span
                    className="flex-shrink-0 w-[18px] h-[18px] mt-[1px] text-emerald-600"
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="12" r="10" />
                      <path
                        d="m8 12 3 3 5-6"
                        stroke="white"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                  </span>
                  <div>
                    <strong className="font-bold">Pronto.</strong> Email casual
                    → profissional em 3 segundos.
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* CTA sticky bottom — só aparece quando typewriter terminou */}
      <AnimatePresence>
        {phase === "result" && finalReady && (
          <motion.footer
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/95 to-transparent border-t border-zinc-100 px-4 pt-2.5 z-20"
            style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
          >
            <div className="max-w-md mx-auto">
              <button
                type="button"
                onClick={handleContinue}
                disabled={continuing}
                className="w-full flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 rounded-[14px] bg-violet-700 text-white text-[14px] font-semibold tracking-[-0.005em] hover:bg-violet-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 active:scale-[0.99]"
              >
                {continuing ? "Continuando…" : "Continuar"}
                {!continuing && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </motion.footer>
        )}
      </AnimatePresence>
    </div>
  );
};
