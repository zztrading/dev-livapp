import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface LivBubbleMessage {
  text: string;
  /** ms que essa mensagem fica visível antes de sumir (default 3000) */
  duration?: number;
}

interface LivBubbleVideoProps {
  videoSrc: string;
  posterSrc?: string;
  /** Lista de balões em sequência. Aparecem um após o outro com transição. */
  messages?: LivBubbleMessage[];
  /** ms antes do primeiro balão aparecer (default 600) */
  initialDelay?: number;
  /** ms de gap entre balões consecutivos (default 400) */
  gapBetween?: number;
  /** Se true, repete o ciclo de mensagens indefinidamente até unmount. */
  loop?: boolean;
  /** classe extra no container fixed */
  className?: string;
  /** alt/label do personagem (a11y) */
  characterLabel?: string;
}

export const LivBubbleVideo = ({
  videoSrc,
  posterSrc,
  messages,
  initialDelay = 600,
  gapBetween = 400,
  loop = false,
  className,
  characterLabel = "Liv, sua mentora",
}: LivBubbleVideoProps) => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    const scheduleCycle = (startDelay: number) => {
      let cursor = startDelay;
      messages.forEach((msg, idx) => {
        const showAt = cursor;
        const duration = msg.duration ?? 3000;
        const hideAt = showAt + duration;

        timers.push(setTimeout(() => !cancelled && setActiveIdx(idx), showAt));
        timers.push(setTimeout(() => !cancelled && setActiveIdx(null), hideAt));

        cursor = hideAt + gapBetween;
      });

      if (loop) {
        timers.push(
          setTimeout(() => {
            if (!cancelled) scheduleCycle(0);
          }, cursor),
        );
      }
    };

    scheduleCycle(initialDelay);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [messages, initialDelay, gapBetween, loop]);

  const activeMessage = activeIdx !== null && messages ? messages[activeIdx] : null;

  return (
    <div
      className={`fixed z-50 flex items-end gap-3 pointer-events-none ${className ?? ""}`}
      style={{
        right: "calc(1.5rem + env(safe-area-inset-right, 0px))",
        bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
      }}
      aria-label={characterLabel}
    >
      {/* Speech bubble — esquerda do vídeo, com tail apontando à direita */}
      <AnimatePresence mode="wait">
        {activeMessage && (
          <motion.div
            key={activeIdx}
            initial={{ opacity: 0, x: 16, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 16, scale: 0.95 }}
            transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
            role="status"
            aria-live="polite"
            className="relative max-w-[220px] sm:max-w-[260px] mb-2 rounded-2xl bg-white border border-indigo-200 shadow-lg shadow-indigo-500/10 px-4 py-2.5"
          >
            <p className="text-sm leading-snug text-slate-700">{activeMessage.text}</p>
            <span
              aria-hidden="true"
              className="absolute -right-[7px] top-1/2 -translate-y-1/2 rotate-45 w-3 h-3 bg-white border-r border-t border-indigo-200"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vídeo bubble */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-[3px] border-white shadow-[0_10px_30px_-8px_rgba(99,102,241,0.4),0_0_0_1px_rgba(99,102,241,0.15)] bg-gradient-to-br from-indigo-50 to-violet-50 pointer-events-auto"
      >
        {/* Fallback REAL: só aparece se o vídeo falhar (onError) */}
        {videoFailed && posterSrc ? (
          <img
            src={posterSrc}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            onError={() => setVideoFailed(true)}
            onCanPlay={() => {
              videoRef.current?.play().catch(() => {});
            }}
            className="w-full h-full object-cover rounded-full scale-[0.92]"
          />
        )}
      </motion.div>
    </div>
  );
};
