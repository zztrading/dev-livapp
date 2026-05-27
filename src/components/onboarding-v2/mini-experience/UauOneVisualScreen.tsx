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

  // Cleanup do timer em unmount (fix #9)
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
        colors: ["#6366f1", "#8b5cf6", "#fbbf24", "#10b981"],
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

  // Imagens ficam no bucket Storage 'uau-images' (URL pública, sem auth).
  // Geradas via /admin/uau-images-gen.
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
  const imageSrc =
    style && theme
      ? `${supabaseUrl}/storage/v1/object/public/uau-images/${style}-${theme}.png`
      : "";

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
          Hora de testar seu instinto visual.
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          Escolha estilo + tema. Eu gero em 2 segundos.
        </p>

        {/* Chips de estilo */}
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          Estilo
        </p>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => phase === "choosing" && setStyle(s.id)}
              disabled={phase !== "choosing"}
              className={`flex flex-col items-center gap-1 px-2 py-3 rounded-2xl border-2 transition-all ${
                style === s.id
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-slate-200 bg-white hover:border-indigo-300"
              } ${phase !== "choosing" ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <span className="text-2xl" aria-hidden="true">
                {s.emoji}
              </span>
              <span className="text-xs font-semibold text-slate-700">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Chips de tema */}
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          Tema
        </p>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => phase === "choosing" && setTheme(t.id)}
              disabled={phase !== "choosing"}
              className={`flex flex-col items-center gap-1 px-2 py-3 rounded-2xl border-2 transition-all ${
                theme === t.id
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-slate-200 bg-white hover:border-indigo-300"
              } ${phase !== "choosing" ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <span className="text-2xl" aria-hidden="true">
                {t.emoji}
              </span>
              <span className="text-xs font-semibold text-slate-700">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Botão gerar / spinner / resultado */}
        <AnimatePresence mode="wait">
          {phase === "choosing" && (
            <motion.button
              key="cta-gerar"
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              whileTap={canGenerate ? { scale: 0.97 } : undefined}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-base font-bold shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <Sparkles className="w-5 h-5" />
              Gerar com IA
            </motion.button>
          )}

          {phase === "generating" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-6"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
              <p className="text-sm text-slate-600">A Liv tá pensando...</p>
              <p className="text-xs text-slate-400">criando sua imagem</p>
            </motion.div>
          )}

          {phase === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-4"
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.45, type: "spring", stiffness: 180 }}
                className="relative w-full aspect-square rounded-2xl overflow-hidden border-2 border-indigo-200 shadow-lg shadow-indigo-500/20"
              >
                {imageError ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-200 via-violet-300 to-pink-300 text-white text-center p-4">
                    <div>
                      <Sparkles className="w-10 h-10 mx-auto mb-2" aria-hidden="true" />
                      <p className="text-sm font-bold">
                        {STYLES.find((s) => s.id === style)?.label} ×{" "}
                        {THEMES.find((t) => t.id === theme)?.label}
                      </p>
                      <p className="text-xs opacity-90 mt-1">imagem mockup pendente</p>
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

              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                <p className="text-sm text-emerald-900 leading-relaxed">
                  <span className="font-bold">✨ Pronto.</span> Isso foi feito com IA em 2 segundos.
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
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
