import { useEffect, useRef, useState } from 'react';

const DURATION = 1000;
const DELAY = 180;

/** Extra wait while the boot log is on screen (set on :root by BootSplash). */
function bootDelay(): number {
  if (typeof document === 'undefined') return 0;
  const v = document.documentElement.style.getPropertyValue('--boot');
  return Number.parseFloat(v) || 0;
}

function reducedMotion(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('rm');
}

/**
 * Counts a figure up from zero on mount, and from its last value when it changes
 * (ease-out quart, as in the Telemetry mock). Returns null when at rest, so the caller
 * renders its exact final text; returns the in-between number while animating.
 */
export function useCountUp(target: number, enabled = true): number | null {
  const [value, setValue] = useState<number | null>(() =>
    enabled && Number.isFinite(target) && target !== 0 && !reducedMotion() ? 0 : null
  );
  // The value last painted, so an interrupted or re-run count resumes from where it was.
  const shown = useRef(0);

  useEffect(() => {
    if (!enabled || !Number.isFinite(target) || reducedMotion()) {
      shown.current = target;
      setValue(null);
      return;
    }
    const from = shown.current;
    if (from === target) {
      setValue(null);
      return;
    }
    setValue(from);
    let raf = 0;
    const timer = window.setTimeout(() => {
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / DURATION);
        const e = 1 - Math.pow(1 - p, 4);
        if (p < 1) {
          shown.current = from + (target - from) * e;
          setValue(shown.current);
          raf = requestAnimationFrame(step);
        } else {
          shown.current = target;
          setValue(null);
        }
      };
      raf = requestAnimationFrame(step);
    }, DELAY + bootDelay());
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, enabled]);

  return value;
}
