import { useEffect, useRef } from "react";

interface LivVideoProps {
  /** Nome do vídeo sem extensão. Ex: "liv-wave". Tenta .mp4 e cai pra .webm. */
  name: string;
  /** Pasta base dos vídeos. Default: /videos/liv/ */
  basePath?: string;
  loop?: boolean;
  muted?: boolean;
  autoPlay?: boolean;
  playsInline?: boolean;
  onEnded?: () => void;
  className?: string;
  /** Texto descritivo pra acessibilidade. */
  ariaLabel?: string;
}

const DEFAULT_BASE_PATH = "/videos/liv/";

export const LivVideo = ({
  name,
  basePath = DEFAULT_BASE_PATH,
  loop = false,
  muted = true,
  autoPlay = true,
  playsInline = true,
  onEnded,
  className,
  ariaLabel,
}: LivVideoProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Reseta o vídeo quando name muda — evita frame congelado da animação anterior
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.load();
    if (autoPlay) {
      const playPromise = v.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // Autoplay bloqueado (sem gesture) — silencioso.
        });
      }
    }
  }, [name, autoPlay]);

  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;

  return (
    <video
      ref={videoRef}
      className={className}
      loop={loop}
      muted={muted}
      autoPlay={autoPlay}
      playsInline={playsInline}
      onEnded={onEnded}
      aria-label={ariaLabel}
    >
      <source src={`${base}${name}.mp4`} type="video/mp4" />
      <source src={`${base}${name}.webm`} type="video/webm" />
    </video>
  );
};
