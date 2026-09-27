import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Empty cells left in the last row of an auto-fill grid holding `count`
 * items, so a filler can span exactly that many columns. 0 when the row is full.
 */
export function useGridRemainder<T extends HTMLElement>(count: number) {
  const ref = useRef<T>(null);
  const [remainder, setRemainder] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const cols = getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
      setRemainder(count % cols ? cols - (count % cols) : 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [count]);
  return { ref, remainder };
}
