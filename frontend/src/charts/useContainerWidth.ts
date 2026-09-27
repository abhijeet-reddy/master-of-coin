import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Measures the element's content width with a ResizeObserver so charts are laid
 * out in real pixels (text never scales with a viewBox).
 */
export function useContainerWidth<T extends HTMLElement = HTMLDivElement>(fallback = 0) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.floor(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect.width ?? 0);
      setWidth((prev) => (prev === w ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}
