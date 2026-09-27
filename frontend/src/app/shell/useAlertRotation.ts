import { useCallback, useEffect, useRef, useState } from 'react';

export const ROTATE_MS = 4500;

/**
 * Rotating index for the alert slot: advances every 4.5s, holds while the
 * pointer or focus is inside, and stops for good while paused. Starts paused
 * when the user prefers reduced motion; the pause button still resumes it.
 */
export function useAlertRotation(count: number, intervalMs = ROTATE_MS, startPaused = false) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(startPaused);
  const hold = useRef(false);

  useEffect(() => {
    if (count < 2 || paused) return;
    const id = window.setInterval(() => {
      if (!hold.current) setIndex((i) => (i + 1) % count);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [count, paused, intervalMs]);

  const setHold = useCallback((on: boolean) => {
    hold.current = on;
  }, []);

  const togglePause = useCallback(() => setPaused((p) => !p), []);

  return {
    index: count ? index % count : 0,
    paused,
    togglePause,
    holdHandlers: {
      onPointerEnter: () => setHold(true),
      onPointerLeave: () => setHold(false),
      onFocus: () => setHold(true),
      onBlur: () => setHold(false),
    },
  };
}
