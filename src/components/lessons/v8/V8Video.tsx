import { useState, useEffect, useRef } from "react";
import { V8VideoMeta } from "@/types/v8Lesson";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

const VIDEO_EXTENSIONS = [".mp4", ".webm"];
const IMAGE_EXTENSIONS = [".webp", ".jpg", ".jpeg", ".png"];

function getExtension(src: string): string {
  const dot = src.lastIndexOf(".");
  return dot !== -1 ? src.slice(dot).toLowerCase() : "";
}

type Phase = "shimmer" | "flash" | "visible";

const SHIMMER_DURATION = 3000;
const FLASH_DURATION = 400;

interface V8VideoProps {
  video: V8VideoMeta;
  onLoad?: () => void;
  /** When provided, ignore IntersectionObserver and start cycle only when this becomes true (narration-driven). */
  externalTrigger?: boolean;
}

export default function V8Video({ video, onLoad, externalTrigger }: V8VideoProps) {
  const [hasError, setHasError] = useState(false);
  const [phase, setPhase] = useState<Phase>("shimmer");
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
  const containerRef = useRef<HTMLElement>(null);
  const useExternalTrigger = externalTrigger !== undefined;

  // External trigger mode: start cycle when externalTrigger flips to true.
  useEffect(() => {
    if (!useExternalTrigger) return;
    if (externalTrigger) setHasEnteredViewport(true);
  }, [useExternalTrigger, externalTrigger]);

  // IntersectionObserver fallback (when no external trigger is provided).
  useEffect(() => {
    if (useExternalTrigger) return;
    if (hasEnteredViewport) return;
    const el = containerRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setHasEnteredViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setHasEnteredViewport(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasEnteredViewport, useExternalTrigger]);

  const { data } = supabase.storage.from("lesson-audios").getPublicUrl(video.src);
  const publicUrl = data?.publicUrl;

  const ext = getExtension(video.src);
  const isVideo = VIDEO_EXTENSIONS.includes(ext);
  const isImage = IMAGE_EXTENSIONS.includes(ext);

  useEffect(() => {
    if (!publicUrl || !hasEnteredViewport) return;

    setPhase("shimmer");
    setHasError(false);

    let cancelled = false;
    let timerDone = false;
    let preloadDone = false;
    let flashTimerId: number | undefined;

    const tryAdvance = () => {
      if (cancelled || !timerDone || !preloadDone) return;
      setPhase("flash");
      flashTimerId = window.setTimeout(() => {
        if (!cancelled) {
          setPhase("visible");
          onLoad?.();
        }
      }, FLASH_DURATION);
    };

    // Timer
    const timerId = setTimeout(() => {
      timerDone = true;
      tryAdvance();
    }, SHIMMER_DURATION);

    // Preload
    if (isImage) {
      const img = new Image();
      img.src = publicUrl;
      img.onload = () => { preloadDone = true; tryAdvance(); };
      img.onerror = () => { if (!cancelled) { setHasError(true); setPhase("visible"); } };
    } else if (isVideo) {
      const vid = document.createElement("video");
      vid.preload = "auto";
      vid.src = publicUrl;
      vid.oncanplaythrough = () => { preloadDone = true; tryAdvance(); };
      vid.onerror = () => { if (!cancelled) { setHasError(true); setPhase("visible"); } };
    } else {
      preloadDone = true;
      tryAdvance();
    }

    return () => {
      cancelled = true;
      clearTimeout(timerId);
      if (flashTimerId) clearTimeout(flashTimerId);
    };
  }, [publicUrl, hasEnteredViewport, isImage, isVideo, onLoad]);

  if (!publicUrl || hasError) {
    return (
      <div className="w-full rounded-xl bg-muted/30 flex items-center justify-center py-8 text-sm text-muted-foreground">
        Mídia indisponível
      </div>
    );
  }

  // Shimmer phase
  if (phase === "shimmer") {
    return (
      <figure ref={containerRef} className="w-full my-4">
        <div className="w-full rounded-xl overflow-hidden relative" style={{ aspectRatio: "16/9" }}>
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(90deg, #E5E7EB 25%, #F3F4F6 50%, #E5E7EB 75%)",
              backgroundSize: "200% 100%",
              animation: "v8-shimmer 1.5s ease-in-out infinite",
            }}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
            <span className="text-sm font-medium text-slate-500">
              {isVideo ? "Gerando vídeo..." : "Gerando imagem..."}
            </span>
          </div>
        </div>
        <style>{`
          @keyframes v8-shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </figure>
    );
  }

  // Flash phase
  if (phase === "flash") {
    return (
      <figure ref={containerRef} className="w-full my-4">
        <div className="w-full rounded-xl overflow-hidden relative" style={{ aspectRatio: "16/9" }}>
          <div
            className="absolute inset-0 bg-white rounded-xl z-10"
            style={{
              animation: "v8-flash-glow 0.4s ease-out forwards",
            }}
          />
          {isImage && (
            <img
              src={publicUrl}
              alt={video.caption || ""}
              className="w-full rounded-xl object-cover opacity-0"
            />
          )}
          {isVideo && (
            <video
              src={publicUrl}
              className="w-full rounded-xl opacity-0"
              muted
              playsInline
            />
          )}
        </div>
        <style>{`
          @keyframes v8-flash-glow {
            0% { opacity: 0; }
            40% { opacity: 0.7; }
            100% { opacity: 0; }
          }
        `}</style>
      </figure>
    );
  }

  // Visible phase
  return (
    <figure ref={containerRef} className="w-full my-4">
      {isVideo ? (
        <video
          src={publicUrl}
          className="w-full rounded-xl transition-opacity duration-700 opacity-100"
          autoPlay
          muted
          loop
          playsInline
          onError={() => setHasError(true)}
        />
      ) : isImage ? (
        <img
          src={publicUrl}
          alt={video.caption || ""}
          className="w-full rounded-xl object-cover transition-opacity duration-700 opacity-100"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="w-full rounded-xl bg-muted/30 flex items-center justify-center py-8 text-sm text-muted-foreground">
          Formato não suportado: {ext}
        </div>
      )}
      {video.caption && (
        <figcaption className="text-center text-xs text-muted-foreground mt-2 italic">
          {video.caption}
        </figcaption>
      )}
    </figure>
  );
}
