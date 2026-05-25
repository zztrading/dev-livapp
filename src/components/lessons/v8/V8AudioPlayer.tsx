import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Loader2, SkipBack, SkipForward } from "lucide-react";

interface V8AudioPlayerProps {
  audioUrl: string;
  autoPlay?: boolean;
  playbackSpeed?: number;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Total lesson duration (sum of all sections). When provided, the timer shows lesson-level time. */
  totalLessonDuration?: number;
  /** Cumulative duration of all previous sections, so currentTime offsets correctly. */
  elapsedBefore?: number;
  /** Navigation callbacks — only rendered when provided (listen mode only) */
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

const PLAYBACK_RATES = [1, 1.25, 1.5, 2] as const;

export const V8AudioPlayer = ({
  audioUrl,
  autoPlay = false,
  playbackSpeed: externalSpeed,
  onEnded,
  onPlay,
  onPause,
  onTimeUpdate,
  totalLessonDuration,
  elapsedBefore = 0,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: V8AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<(typeof PLAYBACK_RATES)[number]>(1);
  const [isLoaded, setIsLoaded] = useState(false);

  // Sync external speed
  useEffect(() => {
    if (
      externalSpeed &&
      (PLAYBACK_RATES as readonly number[]).includes(externalSpeed)
    ) {
      setSpeed(externalSpeed as (typeof PLAYBACK_RATES)[number]);
    }
  }, [externalSpeed]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime, audio.duration);
    };
    const handleDurationChange = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };
    const handleCanPlay = () => setIsLoaded(true);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("canplaythrough", handleCanPlay);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("canplaythrough", handleCanPlay);
    };
  }, [onEnded, onTimeUpdate]);

  // Apply playback rate
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  // Auto-play — also handle cached audio where canplaythrough fires before effect
  useEffect(() => {
    if (!autoPlay || !audioRef.current) return;
    
    const audio = audioRef.current;
    
    const tryPlay = () => {
      if (audio.readyState >= 3) {
        audio.play().then(() => {
          setIsPlaying(true);
          setIsLoaded(true);
          onPlay?.();
        }).catch(() => {});
      }
    };
    
    // If already loaded (cached), play immediately
    if (audio.readyState >= 3) {
      tryPlay();
    } else if (isLoaded) {
      tryPlay();
    }
    
    // Also listen for canplaythrough in case it fires after mount
    audio.addEventListener("canplaythrough", tryPlay, { once: true });
    return () => audio.removeEventListener("canplaythrough", tryPlay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, audioUrl]);

  // Reset on audioUrl change
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setIsLoaded(false);
  }, [audioUrl]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      onPause?.();
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
        onPlay?.();
      }).catch(() => {});
    }
  }, [isPlaying, onPlay, onPause]);

  const [speedOpen, setSpeedOpen] = useState(false);
  const speedRef = useRef<HTMLDivElement>(null);

  const pickSpeed = useCallback((s: (typeof PLAYBACK_RATES)[number]) => {
    setSpeed(s);
    setSpeedOpen(false);
  }, []);

  // Close speed popover on outside click
  useEffect(() => {
    if (!speedOpen) return;
    const handler = (e: MouseEvent) => {
      if (speedRef.current && !speedRef.current.contains(e.target as Node)) {
        setSpeedOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [speedOpen]);

  const handleSeekBar = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
  }, [duration]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // When lesson-level duration is provided, show cumulative time
  const showTotalDuration = totalLessonDuration && totalLessonDuration > 0;
  const displayCurrent = showTotalDuration ? elapsedBefore + currentTime : currentTime;
  const displayDuration = showTotalDuration ? totalLessonDuration : duration;
  const progress = displayDuration > 0 ? (displayCurrent / displayDuration) * 100 : 0;

  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "tween", duration: 0.24, ease: "easeOut" }}
      className="relative w-full flex items-center gap-3 h-12 px-3.5 rounded-xl border border-slate-200 bg-slate-50"
    >
      <audio ref={audioRef} src={audioUrl} preload="auto" />

      {/* SkipBack (only when navigation props are provided) */}
      {onPrev && (
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className={`flex-shrink-0 text-slate-500 active:scale-90 transition-all ${!hasPrev ? 'opacity-30 pointer-events-none' : 'hover:text-slate-700'}`}
          aria-label="Voltar seção"
        >
          <SkipBack className="w-4 h-4" />
        </button>
      )}

      {/* Play / Pause / Loading */}
      {autoPlay && !isLoaded ? (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : (
        <button
          onClick={togglePlay}
          className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white flex-shrink-0 shadow-sm active:scale-95 transition-transform"
          aria-label={isPlaying ? "Pausar" : "Reproduzir"}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isPlaying ? (
              <motion.div
                key="pause"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ duration: 0.12 }}
              >
                <Pause className="w-3 h-3" />
              </motion.div>
            ) : (
              <motion.div
                key="play"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ duration: 0.12 }}
              >
                <Play className="w-3 h-3 ml-0.5" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      )}

      {/* SkipForward (only when navigation props are provided) */}
      {onNext && (
        <button
          onClick={onNext}
          disabled={!hasNext}
          className={`flex-shrink-0 text-slate-500 active:scale-90 transition-all ${!hasNext ? 'opacity-30 pointer-events-none' : 'hover:text-slate-700'}`}
          aria-label="Avançar seção"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      )}

      {/* Progress bar */}
      <div
        className="relative flex-1 h-1.5 rounded-full bg-slate-200 cursor-pointer group"
        onClick={handleSeekBar}
      >
        {autoPlay && !isLoaded ? (
          <div className="absolute inset-0 rounded-full bg-slate-300 animate-pulse" />
        ) : (
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
            style={{ width: `${progress}%` }}
            layout
            transition={{ type: "tween", duration: 0.1 }}
          />
        )}
      </div>

      {/* Time */}
      <span
        className={`text-[11px] font-mono tabular-nums flex-shrink-0 min-w-[52px] text-center transition-colors ${
          autoPlay && !isLoaded ? "text-slate-300" : "text-slate-500"
        }`}
        aria-live="off"
      >
        {`${formatTime(displayCurrent)}/${formatTime(displayDuration)}`}
      </span>

      {/* Speed — popover with all rates */}
      <div ref={speedRef} className="relative flex-shrink-0">
        <button
          onClick={() => setSpeedOpen((o) => !o)}
          aria-label={`Velocidade atual ${speed}x. Toque para mudar.`}
          aria-haspopup="menu"
          aria-expanded={speedOpen}
          className={`text-[11px] font-semibold font-mono transition-colors min-w-[28px] px-1.5 py-0.5 rounded ${
            speedOpen ? "text-indigo-600 bg-indigo-50" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {speed}x
        </button>
        <AnimatePresence>
          {speedOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              role="menu"
              aria-label="Velocidade de reprodução"
              className="absolute bottom-full right-0 mb-2 flex items-center gap-1 p-1 rounded-lg bg-white border border-slate-200 shadow-lg z-10"
            >
              {PLAYBACK_RATES.map((r) => (
                <button
                  key={r}
                  onClick={() => pickSpeed(r)}
                  role="menuitemradio"
                  aria-checked={speed === r}
                  className={`text-[11px] font-semibold font-mono px-2 py-1 rounded transition-colors whitespace-nowrap ${
                    speed === r
                      ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {r}x
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
