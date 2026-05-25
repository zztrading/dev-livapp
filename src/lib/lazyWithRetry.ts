import { lazy, ComponentType } from "react";

/**
 * Wraps React.lazy with automatic retry on dynamic import failures
 * (common after a new deploy invalidates old chunk hashes).
 *
 * - Retries up to `retries` times with exponential backoff.
 * - On final failure, force-reloads the page once (guarded via sessionStorage)
 *   so the browser fetches the new index.html + chunk manifest.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  opts: { retries?: number; baseDelayMs?: number; name?: string } = {}
) {
  const { retries = 3, baseDelayMs = 400, name = "chunk" } = opts;

  return lazy(async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await factory();
      } catch (err) {
        lastErr = err;
        const msg = String((err as any)?.message ?? err ?? "");
        const isChunkErr =
          /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk \d+ failed/i.test(
            msg
          );
        if (!isChunkErr || attempt === retries) break;
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.warn(
          `[lazyWithRetry] ${name} falhou (tentativa ${attempt + 1}/${retries + 1}). Retry em ${delay}ms.`,
          msg
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    // Última cartada: recarregar a página 1x para pegar o novo manifest.
    const guardKey = `ailiv_lazy_reload_${name}`;
    if (typeof window !== "undefined" && !sessionStorage.getItem(guardKey)) {
      sessionStorage.setItem(guardKey, "1");
      console.warn(`[lazyWithRetry] ${name} indisponível após retries. Recarregando página.`);
      window.location.reload();
      // Devolve um componente vazio enquanto reload acontece
      return { default: (() => null) as unknown as T };
    }

    throw lastErr;
  });
}
