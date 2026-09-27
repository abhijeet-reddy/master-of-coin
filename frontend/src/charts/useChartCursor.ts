import { useCallback, useState, type KeyboardEvent } from 'react';

/**
 * Active data index for hover and keyboard. Arrow keys step, Home/End jump,
 * Escape clears. The same readout serves pointer and keyboard users.
 */
export function useChartCursor(count: number) {
  const [index, setIndex] = useState<number | null>(null);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (count === 0) return;
      const cur = index ?? -1;
      let next: number | null = cur;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(count - 1, cur + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
        next = Math.max(0, cur < 0 ? count - 1 : cur - 1);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = count - 1;
      else if (e.key === 'Escape') next = null;
      else return;
      e.preventDefault();
      setIndex(next);
    },
    [count, index]
  );

  const clear = useCallback(() => setIndex(null), []);
  return { index, setIndex, onKeyDown, clear };
}
