/**
 * Shared V8 scroll utilities — deterministic geometric scroll for CTAs.
 * Used by V8PlaygroundInline and V8QuizInline to guarantee CTA visibility.
 */

/** Safe margins (px) */
export const V8_SAFE_TOP = 116;  // progress bar (4) + header content (~56) + breathing room (56)
/** Bottom reserved when the V8 fixed bottom bar is mounted (sections / learn-and-grow). */
export const V8_SAFE_BOTTOM_WITH_BAR = 120; // py-3 + content (~70) + safe-area + folga
/** Bottom reserved when CTA is inline (quizzes, exercises sem barra fixa). */
export const V8_SAFE_BOTTOM_INLINE = 32; // só env(safe-area-inset-bottom) + respiro
/** Legacy alias — mantém comportamento dos chamadores que ainda esperam o valor "com barra". */
export const V8_SAFE_BOTTOM = V8_SAFE_BOTTOM_WITH_BAR;
export const V8_DELTA_PADDING = 16; // extra breathing below CTA

/**
 * Ensures an element is fully visible within the safe viewport area.
 * Uses deterministic geometric calculation — never relies on `block: "nearest"`.
 *
 * @returns `true` if the element was found (visible or scrolled-to), `false` if ref is null.
 */
export function ensureElementVisible(
  el: HTMLElement | null,
  options?: { safeTop?: number; safeBottom?: number; padding?: number }
): boolean {
  if (!el) return false;

  const safeTop = options?.safeTop ?? V8_SAFE_TOP;
  const safeBottom = options?.safeBottom ?? V8_SAFE_BOTTOM;
  const padding = options?.padding ?? V8_DELTA_PADDING;

  const rect = el.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const maxVisible = viewportHeight - safeBottom;

  // CTA is below the visible safe area
  if (rect.bottom > maxVisible) {
    window.scrollBy({
      top: rect.bottom - maxVisible + padding,
      behavior: "smooth",
    });
    return true;
  }

  // CTA is above the visible safe area (scrolled past)
  if (rect.top < safeTop) {
    window.scrollBy({
      top: rect.top - safeTop - padding,
      behavior: "smooth",
    });
    return true;
  }

  return true; // already visible
}

/**
 * Aligns the top of an element to just below the safe top area (header).
 * Use this when you want to anchor an element to the top of the viewport,
 * not just ensure it's visible. Ideal for section transitions and media reveals.
 *
 * @returns `true` if the element was found, `false` if ref is null.
 */
export function alignElementToTop(
  el: HTMLElement | null,
  options?: { safeTop?: number; offset?: number }
): boolean {
  if (!el) return false;

  const safeTop = options?.safeTop ?? V8_SAFE_TOP;
  const offset = options?.offset ?? 0;

  const rect = el.getBoundingClientRect();
  const delta = rect.top - safeTop - offset;

  // Only scroll if the element isn't already aligned (within 4px tolerance)
  if (Math.abs(delta) > 4) {
    window.scrollBy({
      top: delta,
      behavior: "smooth",
    });
  }
  return true;
}

/**
 * Schedules a CTA visibility check after AnimatePresence transitions.
 * Runs primary check at 300ms and safety-net re-check at 600ms.
 *
 * @returns cleanup function to clear timers.
 */
export function scheduleCTAScroll(
  getElement: () => HTMLElement | null,
  fallbackElement?: () => HTMLElement | null,
  options?: { safeTop?: number; safeBottom?: number; padding?: number }
): () => void {
  const attempt = () => {
    const el = getElement();
    if (ensureElementVisible(el, options)) return true;

    const fb = fallbackElement?.();
    if (fb) {
      ensureElementVisible(fb, options);
      return true;
    }
    return false;
  };

  const timer1 = setTimeout(attempt, 300);
  const timer2 = setTimeout(() => {
    ensureElementVisible(getElement(), options);
  }, 600);

  return () => {
    clearTimeout(timer1);
    clearTimeout(timer2);
  };
}

/**
 * Schedules a top-anchor scroll for elements that should remain visible
 * from the top of the safe viewport area. Used in wrong/feedback states
 * where the user needs to re-read content above the CTAs.
 *
 * Runs primary at 300ms and safety-net re-check at 600ms.
 */
export function scheduleTopAnchor(
  getElement: () => HTMLElement | null,
  options?: { safeTop?: number; offset?: number }
): () => void {
  const attempt = () => alignElementToTop(getElement(), options);
  const timer1 = setTimeout(attempt, 300);
  const timer2 = setTimeout(attempt, 600);

  return () => {
    clearTimeout(timer1);
    clearTimeout(timer2);
  };
}

/**
 * Smart anchor scroll for wrong-state feedback:
 * - If the content from rootRef.top to ctaRef.bottom fits within the safe viewport,
 *   aligns rootRef.top to safeTop (user sees the question + everything below).
 * - Otherwise, falls back to ensureElementVisible(ctaRef) — preserves the old
 *   behavior of keeping CTAs visible at the cost of the question.
 *
 * Runs primary at 300ms and safety-net re-check at 600ms.
 */
export function scheduleSmartAnchor(
  getRoot: () => HTMLElement | null,
  getCta: () => HTMLElement | null,
  options?: { safeTop?: number; safeBottom?: number; padding?: number }
): () => void {
  const safeTop = options?.safeTop ?? V8_SAFE_TOP;
  const safeBottom = options?.safeBottom ?? V8_SAFE_BOTTOM;

  const attempt = () => {
    const root = getRoot();
    const cta = getCta();
    if (!root) return;

    const rootRect = root.getBoundingClientRect();
    const ctaRect = cta?.getBoundingClientRect();

    // If cta is missing, fallback to anchor-top only.
    if (!ctaRect) {
      alignElementToTop(root, { safeTop });
      return;
    }

    const contentHeight = ctaRect.bottom - rootRect.top;
    const availableHeight = window.innerHeight - safeTop - safeBottom;

    if (contentHeight <= availableHeight) {
      // Fits — anchor question to top so user re-reads it.
      alignElementToTop(root, { safeTop });
    } else {
      // Doesn't fit — keep CTA visible (old scroll-to-cta behavior).
      ensureElementVisible(cta, { safeTop, safeBottom });
    }
  };

  const timer1 = setTimeout(attempt, 300);
  const timer2 = setTimeout(attempt, 600);

  return () => {
    clearTimeout(timer1);
    clearTimeout(timer2);
  };
}
