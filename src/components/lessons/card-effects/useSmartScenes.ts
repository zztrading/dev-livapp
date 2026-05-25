import { useState, useEffect } from 'react';

/**
 * useSmartScenes — Hook para progressão inteligente de cenas
 * 
 * Em vez de comprimir todas as cenas em tempo insuficiente (ilegível),
 * seleciona inteligentemente quais cenas mostrar respeitando um tempo
 * mínimo por cena (2.5s).
 * 
 * - Se há tempo suficiente: mostra todas as cenas normalmente
 * - Se não: seleciona cenas proporcionalmente, sempre incluindo a primeira e a última
 */

const MIN_SCENE_TIME_MS = 2500; // 2.5 segundos mínimo por cena

interface SmartScenesResult {
  /** Índice da cena atual (0-indexed, mapeado para cenas originais) */
  currentScene: number;
  /** Tempo de cada cena em ms */
  sceneTime: number;
  /** Total de cenas efetivas sendo mostradas */
  effectiveSceneCount: number;
  /** Total original de cenas */
  totalScenes: number;
}

export function useSmartScenes(
  totalScenes: number,
  duration: number, // em segundos
  isActive: boolean
): SmartScenesResult {
  const [internalStep, setInternalStep] = useState(0);

  const durationMs = duration * 1000;
  const normalSceneTime = durationMs / totalScenes;

  // Se o tempo por cena é >= mínimo, mostra tudo normalmente
  const needsSkip = normalSceneTime < MIN_SCENE_TIME_MS;

  // Quantas cenas cabem no tempo disponível
  const effectiveSceneCount = needsSkip
    ? Math.max(2, Math.floor(durationMs / MIN_SCENE_TIME_MS)) // mínimo 2 (primeira + última)
    : totalScenes;

  const sceneTime = durationMs / effectiveSceneCount;

  // Mapear step interno → índice de cena original
  // Sempre inclui cena 0 e cena (totalScenes-1)
  // Cenas intermediárias são distribuídas proporcionalmente
  const mapToOriginalScene = (step: number): number => {
    if (!needsSkip) return step;
    if (step === 0) return 0;
    if (step >= effectiveSceneCount - 1) return totalScenes - 1;
    // Distribuir cenas intermediárias proporcionalmente
    const ratio = step / (effectiveSceneCount - 1);
    return Math.round(ratio * (totalScenes - 1));
  };

  useEffect(() => {
    if (!isActive) {
      // Don't reset — just pause (freeze current scene)
      return;
    }

    const interval = setInterval(() => {
      setInternalStep(prev => (prev < effectiveSceneCount - 1 ? prev + 1 : prev));
    }, sceneTime);

    return () => clearInterval(interval);
  }, [isActive, sceneTime, effectiveSceneCount]);

  return {
    currentScene: mapToOriginalScene(internalStep),
    sceneTime,
    effectiveSceneCount,
    totalScenes,
  };
}
