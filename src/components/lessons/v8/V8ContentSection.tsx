import { forwardRef, useEffect, useState, useRef, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { V8Section } from "@/types/v8Lesson";
import { sanitizeV8PedagogicalText, stripProsodyTagsForDisplay } from "@/lib/v8TextSanitizer";
import AiImage from "@/components/lessons/v10/PartB/elements/AiImage";
import V8Video from "./V8Video";
import { ensureElementVisible, alignElementToTop, V8_SAFE_BOTTOM, V8_SAFE_TOP } from "./v8ScrollUtils";

interface V8ContentSectionProps {
  section: V8Section;
  mode: "read" | "listen";
  sectionIndex: number;
  lessonId?: string;
  /** Current audio playback time of THIS section (seconds). Only set when this section is the active one in listen mode. */
  audioCurrentTime?: number;
  /** Audio duration of THIS section (seconds). */
  audioDuration?: number;
  /** True when this section is the currently active one being narrated. */
  isActiveAudio?: boolean;
}

/** Strip "Seção X — " prefix from section titles */
const cleanSectionTitle = (title: string) =>
  title.replace(/^#{1,6}\s*/, "").replace(/^Seção\s*\d+\s*[—–\-:]\s*/i, "");

interface V8TrimmedImageProps {
  src: string;
  alt: string;
  className?: string;
}

const trimmedImageCache = new Map<string, string>();
// Cache version — increment to invalidate when algorithm changes
const TRIM_VERSION = 2;

const V8TrimmedImage = ({ src, alt, className }: V8TrimmedImageProps) => {
  const cachedSrc = trimmedImageCache.get(`${TRIM_VERSION}:${src}`);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(cachedSrc ?? null);
  const [visible, setVisible] = useState(!!cachedSrc);

  useEffect(() => {
    let cancelled = false;

    const cacheKey = `${TRIM_VERSION}:${src}`;
    const cached = trimmedImageCache.get(cacheKey);
    if (cached) {
      setResolvedSrc(cached);
      setVisible(true);
      return;
    }

    setResolvedSrc(null);
    setVisible(false);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    img.onload = () => {
      try {
        const sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = img.naturalWidth;
        sourceCanvas.height = img.naturalHeight;

        const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
        if (!sourceCtx) throw new Error("NO_CANVAS_CONTEXT");

        sourceCtx.drawImage(img, 0, 0);

        const { data, width, height } = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);

        const sampleBg = (px: number, py: number) => {
          const i = (py * width + px) * 4;
          return [data[i], data[i + 1], data[i + 2]];
        };
        const corners = [
          sampleBg(0, 0),
          sampleBg(width - 1, 0),
          sampleBg(0, height - 1),
          sampleBg(width - 1, height - 1),
        ];
        const bgR = Math.round(corners.reduce((s, c) => s + c[0], 0) / 4);
        const bgG = Math.round(corners.reduce((s, c) => s + c[1], 0) / 4);
        const bgB = Math.round(corners.reduce((s, c) => s + c[2], 0) / 4);

        let minX = width, minY = height, maxX = -1, maxY = -1;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            if (a < 10) continue;
            const dist = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
            if (dist < 30) continue;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }

        if (maxX < 0 || maxY < 0) {
          if (!cancelled) {
            setResolvedSrc(src);
          }
          return;
        }

        const padding = 4;
        const cropX = Math.max(0, minX - padding);
        const cropY = Math.max(0, minY - padding);
        const cropWidth = Math.min(width - cropX, maxX - minX + 1 + padding * 2);
        const cropHeight = Math.min(height - cropY, maxY - minY + 1 + padding * 2);

        const croppedCanvas = document.createElement("canvas");
        croppedCanvas.width = cropWidth;
        croppedCanvas.height = cropHeight;

        const croppedCtx = croppedCanvas.getContext("2d");
        if (!croppedCtx) throw new Error("NO_CROPPED_CONTEXT");

        croppedCtx.drawImage(sourceCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

        const croppedSrc = croppedCanvas.toDataURL("image/png");
        trimmedImageCache.set(cacheKey, croppedSrc);

        if (!cancelled) {
          setResolvedSrc(croppedSrc);
        }
      } catch {
        if (!cancelled) {
          setResolvedSrc(src);
        }
      }
    };

    img.onerror = () => {
      if (!cancelled) {
        setResolvedSrc(src);
      }
    };

    img.src = src;

    return () => { cancelled = true; };
  }, [src]);

  if (!resolvedSrc) {
    return (
      <div className={`block w-full max-w-[300px] aspect-square mx-auto rounded-2xl bg-slate-100 animate-pulse ${className ?? ''}`} />
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={`block transition-opacity duration-500 ease-out ${visible ? 'opacity-100' : 'opacity-0'} ${className ?? ''}`}
      loading="lazy"
      onLoad={(e) => {
        if (!visible) {
          const imgEl = e.currentTarget;
          if (imgEl.decode) {
            imgEl.decode().then(() => setVisible(true)).catch(() => setVisible(true));
          } else {
            requestAnimationFrame(() => setVisible(true));
          }
        }
      }}
    />
  );
};

export const V8ContentSection = forwardRef<HTMLDivElement, V8ContentSectionProps>(
  ({ section, mode, sectionIndex, lessonId, audioCurrentTime = 0, audioDuration = 0, isActiveAudio = false }, ref) => {
    const cleanTitle = cleanSectionTitle(stripProsodyTagsForDisplay(sanitizeV8PedagogicalText(section.title)));
    const sanitizedContent = stripProsodyTagsForDisplay(sanitizeV8PedagogicalText(section.content));

    const aiImageContainerRef = useRef<HTMLDivElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);

    const getVideoScrollTarget = useCallback(() => {
      return (videoContainerRef.current?.firstElementChild as HTMLElement | null) ?? videoContainerRef.current;
    }, []);

    const handleAiImageReady = useCallback(() => {
      if (mode !== "listen") return;
      requestAnimationFrame(() => {
        alignElementToTop(aiImageContainerRef.current, {
          safeTop: V8_SAFE_TOP,
          offset: 8,
        });
      });
    }, [mode]);

    const handleVideoLoad = useCallback(() => {
      requestAnimationFrame(() => {
        alignElementToTop(getVideoScrollTarget(), {
          safeTop: V8_SAFE_TOP,
          offset: 8,
        });
      });
    }, [getVideoScrollTarget]);

    // Narration-driven trigger: compute when each video should be revealed
    // based on audio progress (triggerAtSeconds OR triggerAtPercent, default 0.5).
    const referenceDuration = audioDuration || section.audioDurationSeconds || 0;
    const videoTriggers = useMemo(() => {
      if (!section.videos?.length) return [];
      return section.videos.map((vid) => {
        const triggerSec = typeof vid.triggerAtSeconds === "number"
          ? vid.triggerAtSeconds
          : (referenceDuration > 0 ? referenceDuration * (vid.triggerAtPercent ?? 0.5) : 0);
        return triggerSec;
      });
    }, [section.videos, referenceDuration]);

    const [videoActive, setVideoActive] = useState<boolean[]>(() =>
      (section.videos ?? []).map(() => false)
    );

    useEffect(() => {
      setVideoActive((section.videos ?? []).map(() => false));
    }, [section.videos]);

    useEffect(() => {
      if (mode !== "listen" || !isActiveAudio || !section.videos?.length) return;
      setVideoActive((prev) => {
        let changed = false;
        const next = prev.map((wasActive, i) => {
          if (wasActive) return true;
          const trigger = videoTriggers[i] ?? 0;
          if (audioCurrentTime >= trigger && trigger > 0) {
            changed = true;
            return true;
          }
          return wasActive;
        });
        return changed ? next : prev;
      });
    }, [audioCurrentTime, mode, isActiveAudio, section.videos, videoTriggers]);

    const prevAnyActiveRef = useRef(false);
    useEffect(() => {
      const anyActive = videoActive.some(Boolean);
      if (anyActive && !prevAnyActiveRef.current && mode === "listen") {
        prevAnyActiveRef.current = true;
        requestAnimationFrame(() => {
          alignElementToTop(getVideoScrollTarget(), {
            safeTop: V8_SAFE_TOP,
            offset: 8,
          });
        });
      }
      if (!anyActive) prevAnyActiveRef.current = false;
    }, [videoActive, mode, getVideoScrollTarget]);

    let paragraphCount = 0;

    return (
      <div
        ref={ref}
        id={`v8-section-${sectionIndex}`}
        className="flex flex-col"
      >
        {/* 1. Section title with visual marker */}
        <div className="flex flex-col gap-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            Seção {String(sectionIndex + 1).padStart(2, '0')}
          </div>
          <h2 className="text-[22px] font-bold leading-tight text-foreground">
            {cleanTitle}
          </h2>
          <div className="h-[3px] w-16 rounded-full bg-gradient-to-r from-primary via-primary/60 to-transparent opacity-90" />
        </div>

        {/* 2. Image — BEFORE markdown */}
        {section.imageUrl && (
          <div className="mt-[30px] flex justify-center">
            <V8TrimmedImage
              src={section.imageUrl}
              alt={cleanTitle}
              className="w-full max-w-[300px] rounded-2xl object-contain"
            />
          </div>
        )}

        {/* 3. Markdown body — Editorial card */}
        <div className="relative mt-5 overflow-hidden rounded-[24px] border border-border/60 bg-card/95 shadow-sm">
          <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary/20 to-transparent" />
          <div className="v8-markdown px-5 py-5 text-[16.5px] leading-[1.85] tracking-[-0.01em] text-muted-foreground text-left [&>*:last-child]:mb-0 sm:px-6 sm:py-6">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="mt-6 mb-4 text-[22px] font-bold leading-tight text-foreground first:mt-0">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mt-6 mb-3 flex items-center gap-2.5 text-[19px] font-semibold leading-tight text-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-sm shadow-primary/30" aria-hidden />
                    <span>{children}</span>
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mt-5 mb-3 flex items-center gap-2 text-[17px] font-semibold leading-tight text-foreground/90">
                    <span className="h-2 w-2 rounded-full bg-primary/60" aria-hidden />
                    <span>{children}</span>
                  </h3>
                ),
                p: ({ children }) => {
                  const isFirst = paragraphCount === 0;
                  paragraphCount++;
                  return isFirst ? (
                    <p className="mb-5 rounded-2xl border border-primary/10 bg-primary/[0.05] px-4 py-4 text-[17.5px] leading-[1.95] text-foreground/90 indent-6 shadow-sm first-letter:text-[1.4em] first-letter:font-semibold first-letter:text-primary">
                      {children}
                    </p>
                  ) : (
                    <p className="mb-[18px] text-foreground/80 indent-6">{children}</p>
                  );
                },
                ul: ({ children }) => (
                  <ul className="mb-5 list-disc list-outside space-y-3 rounded-2xl border border-border/50 bg-muted/35 px-4 py-4 pl-8 shadow-sm marker:text-primary">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-5 list-decimal list-outside space-y-3 rounded-2xl border border-border/50 bg-muted/35 px-4 py-4 pl-8 shadow-sm marker:font-semibold marker:text-primary">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="pl-1 text-foreground/80">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="rounded-md bg-primary/10 px-1 py-0.5 font-semibold text-foreground">
                    {children}
                  </strong>
                ),
                em: ({ children }) => (
                  <em className="rounded-md bg-accent/40 px-1.5 py-0.5 font-medium not-italic text-foreground">
                    {children}
                  </em>
                ),
                code: ({ children, className }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="rounded-md border border-border/60 bg-muted px-1.5 py-0.5 text-[15px] font-mono text-primary">
                      {children}
                    </code>
                  ) : (
                    <code className="mb-4 block overflow-x-auto rounded-2xl border border-border/60 bg-muted p-4 text-sm font-mono text-foreground/80 shadow-sm">
                      {children}
                    </code>
                  );
                },
                blockquote: ({ children }) => (
                  <blockquote className="relative my-5 rounded-2xl border border-primary/15 bg-primary/[0.05] px-5 py-4 text-foreground/80 shadow-sm [&>p]:mb-0">
                    <span className="absolute left-4 top-3 text-2xl leading-none text-primary/25 select-none" aria-hidden>
                      ❝
                    </span>
                    <div className="pl-5">{children}</div>
                  </blockquote>
                ),
                hr: () => (
                  <div className="my-8 flex items-center justify-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-primary/30" />
                    <span className="h-1.5 w-10 rounded-full bg-gradient-to-r from-primary/80 via-primary/30 to-transparent" />
                    <span className="h-1 w-1 rounded-full bg-primary/30" />
                  </div>
                ),
              }}
            >
              {sanitizedContent}
            </ReactMarkdown>
          </div>
        </div>

        {/* 4. AI-generated images (runtime) */}
        {section.aiImages && section.aiImages.length > 0 && (
          <div ref={aiImageContainerRef} className="flex flex-col gap-4 mt-4">
            {section.aiImages.map((img, i) => (
              <AiImage
                key={`ai-img-${sectionIndex}-${i}`}
                prompt={img.prompt}
                caption={img.caption}
                lessonId={lessonId}
                onImageReady={handleAiImageReady}
              />
            ))}
          </div>
        )}

        {/* 5. Static video/image assets */}
        {section.videos && section.videos.length > 0 && (
          <div ref={videoContainerRef} className="flex flex-col gap-4 mt-4">
            {section.videos.map((vid, i) => (
              <V8Video
                key={`vid-${sectionIndex}-${i}`}
                video={vid}
                onLoad={handleVideoLoad}
                externalTrigger={mode === "listen" ? videoActive[i] : undefined}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
);

V8ContentSection.displayName = "V8ContentSection";
