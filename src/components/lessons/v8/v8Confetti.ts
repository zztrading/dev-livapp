import confetti from "canvas-confetti";

/**
 * Confete celebratório para acerto 100% em exercício inline V8.
 * Burst menor que end-of-lesson (V8CompletionScreen 120 particles) —
 * comparable a V8InsightReward (100 particles).
 *
 * Disparado SÓ em acerto total (correctCount === total), não em PASS_SCORE.
 */
export const fireInlineConfetti = () => {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#10b981', '#6366f1', '#8b5cf6', '#fbbf24'],
  });
};
