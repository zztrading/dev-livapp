/**
 * Tela 5 (UAU 1) — variante Visual.
 * Aluno escolhe estilo + tema, clica "Gerar com IA", spinner de 2s
 * e a imagem mockup aparece com fade-in. Custo $0.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import confetti from "canvas-confetti";

interface UauOneVisualScreenProps {
  stepLabel: string;
  onComplete: (data: { style: string; theme: string }) => Promise<void>;
}

const STYLES = [
  { id: "realista", emoji: "🎨", label: "Realista" },
  { id: "cartoon", emoji: "✏️", label: "Cartoon" },
  { id: "foto", emoji: "📸", label: "Foto" },
];

const THEMES = [
  { id: "paisagem", emoji: "🏔️", label: "Paisagem" },
  { id: "futurista", emoji: "🚀", label: "Futurista" },
  { id: "natureza", emoji: "🌸", label: "Natureza" },
];

type Phase = "choosing" | "generating" | "result";

export const UauOneVisualScreen = ({
  stepLabel,
  onComplete,
}: UauOneVisualScreenProps) => {
  const [style, setStyle] = useState<string | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("choosing");
  const [imageError, setImageError] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const generateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canGenerate = style !== null && theme !== null;

  useEffect(
    () => () => {
      if (generateTimerRef.current) clearTimeout(generateTimerRef.current);
    },
    [],
  );

  const handleGenerate = useCallback(() => {
    if (!canGenerate || !style || !theme) return;
    setPhase("generating");
    generateTimerRef.current = setTimeout(() => {
      generateTimerRef.current = null;
      setPhase("result");
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { y: 0.45 },
        colors: ["#6D28D9", "#8B5CF6", "#fbbf24", "#10b981"],
        scalar: 0.85,
      });
    }, 2000);
  }, [canGenerate, style, theme]);

  const handleContinue = useCallback(async () => {
    if (continuing || !style || !theme) return;
    setContinuing(true);
    try {
      await onComplete({ style, theme });
    } finally {
      setContinuing(false);
    }
  }, [continuing, style, theme, onComplete]);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
  const imageSrc =
    style && theme
      ? `${supabaseUrl}/storage/v1/object/public/uau-images/${style}-${theme}.png`
      : "";

  const showStickyCta =
    (phase === "choosing" && canGenerate) || phase === "result";
  const stickyDisabled = phase === "choosing" ? !canGenerate : continuing;
  const stickyLabel =
    phase === "result"
      ? continuing
        ? "Continuando…"
        : "Continuar"
      : "Gerar com IA";

  return (
    <div className="min-h-screen flex flex-col bg-white pt-24">
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-32 max-w-md w-full mx-auto flex flex-col gap-3.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-violet-700">
          {stepLabel}
        </span>

        <h1 className="text-[20px] sm:text-[23px] font-bold leading-[1.28] tracking-[-0.025em] text-zinc-950">
          <span className="block text-[14.5px] sm:text-[15.5px] font-normal text-zinc-700 leading-[1.5] mb-2 tracking-[-0.005em]">
            Hora de testar seu instinto visual.
          </span>
          Escolha estilo + tema. Eu gero em 2 segundos.
        </h1>

        {/* Chips de estilo */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500">
            Estilo
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {STYLES.map((s) => {
              const picked = style === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => phase === "choosing" && setStyle(s.id)}
                  disabled={phase !== "choosing"}
                  className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-[14px] border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 active:scale-[0.98] ${
                    picked
                      ? "border-violet-700 bg-violet-50"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  } ${phase !== "choosing" ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <span className="text-[20px] leading-none" aria-hidden="true">
                    {s.emoji}
                  </span>
                  <span className="text-[12px] font-semibold text-zinc-800">
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chips de tema */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500">
            Tema
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {THEMES.map((t) => {
              const picked = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => phase === "choosing" && setTheme(t.id)}
                  disabled={phase !== "choosing"}
                  className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-[14px] border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 active:scale-[0.98] ${
                    picked
                      ? "border-violet-700 bg-violet-50"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  } ${phase !== "choosing" ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <span className="text-[20px] leading-none" aria-hidden="true">
                    {t.emoji}
                  </span>
                  <span className="text-[12px] font-semibold text-zinc-800">
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Generating spinner / Resultado */}
        <AnimatePresence mode="wait">
          {phase === "generating" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2 py-6"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="w-8 h-8 animate-spin text-violet-700" />
              <p className="text-[13px] text-zinc-600">A Liv tá pensando…</p>
              <p className="text-[11px] text-zinc-400">criando sua imagem</p>
            </motion.div>
          )}

          {phase === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-3"
            >
              <motion.div
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.45, type: "spring", stiffness: 180 }}
                className="relative w-full aspect-square rounded-[14px] overflow-hidden border border-zinc-200"
              >
                {imageError ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-200 via-violet-300 to-pink-300 text-white text-center p-4">
                    <div>
                      <Sparkles
                        className="w-8 h-8 mx-auto mb-2"
                        aria-hidden="true"
                      />
                      <p className="text-[13px] font-bold">
                        {STYLES.find((s) => s.id === style)?.label} ×{" "}
                        {THEMES.find((t) => t.id === theme)?.label}
                      </p>
                      <p className="text-[11px] opacity-90 mt-1">
                        imagem mockup pendente
                      </p>
                    </div>
                  </div>
                ) : (
                  <img
                    src={imageSrc}
                    alt={`Imagem gerada: estilo ${style}, tema ${theme}`}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                )}
              </motion.div>

              <div
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
                  <strong className="font-bold">Pronto.</strong> Isso foi feito
                  com IA em 2 segundos.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* CTA sticky bottom */}
      <AnimatePresence>
        {showStickyCta && (
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
                onClick={phase === "result" ? handleContinue : handleGenerate}
                disabled={stickyDisabled}
                className={`w-full flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 rounded-[14px] text-[14px] font-semibold tracking-[-0.005em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 active:scale-[0.99] ${
                  stickyDisabled
                    ? "bg-zinc-300 text-white cursor-not-allowed"
                    : phase === "result"
                      ? "bg-violet-700 text-white hover:bg-violet-800"
                      : "bg-zinc-950 text-white hover:bg-zinc-800"
                }`}
              >
                {phase === "choosing" && <Sparkles className="w-4 h-4" />}
                {stickyLabel}
                {phase === "result" && !continuing && (
                  <ArrowRight className="w-4 h-4" />
                )}
              </button>
            </div>
          </motion.footer>
        )}
      </AnimatePresence>
    </div>
  );
};
