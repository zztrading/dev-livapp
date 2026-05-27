import { useCallback, useState } from "react";

/**
 * Hook compartilhado pelas telas de pergunta single-choice.
 * Trava cliques após a primeira escolha pra evitar:
 *   - Race condition entre saveAnswer + goNext
 *   - Usuário trocar resposta no meio da transição
 *   - Duplicação de eventos analytics
 *
 * O `picked` value reflete a escolha local imediata (UI feedback),
 * mesmo antes de o pai persistir via `selected` prop.
 */
export function useSingleChoiceGate(
  onSelect: (value: string) => void | Promise<void>,
  selected?: string,
) {
  const [picked, setPicked] = useState<string | null>(null);
  const effectiveSelected = picked ?? selected ?? null;

  const handlePick = useCallback(
    async (value: string) => {
      if (picked) return;
      setPicked(value);
      await onSelect(value);
    },
    [picked, onSelect],
  );

  return {
    /** Valor selecionado (prioriza picked local) */
    selected: effectiveSelected,
    /** Botões devem ficar disabled? */
    isLocked: picked !== null,
    handlePick,
  };
}
