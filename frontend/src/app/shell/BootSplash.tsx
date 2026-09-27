import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '@/design';
import { usePreferences } from '@/lib/preferences';
import { useVersionLabel } from './useVersionLabel';
import styles from './BootSplash.module.css';

const KEY = 'moc-booted';
const STEP_MS = 85;
const EXIT_MS = 480;

function alreadyBooted(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
}

/**
 * The Telemetry boot log: once per browser session, a terminal log types out and a bar
 * fills, then the screen wipes up to reveal the app. Any key or click skips it.
 * Never shown under reduced motion. Purely decorative (aria-hidden).
 */
export function BootSplash() {
  const [phase, setPhase] = useState<'on' | 'out' | 'done'>(() =>
    alreadyBooted() || prefersReducedMotion() ? 'done' : 'on'
  );
  const version = useVersionLabel();
  const { prefs } = usePreferences();

  const lines: [string, string][] = [
    ['MASTER OF COIN', `FIN/TERMINAL ${version ?? ''}`.trim()],
    ['LINK', 'OK'],
    ['LEDGER', 'ONLINE'],
    ['FX', `${prefs.default_currency} BASE`],
    ['BUDGETS', 'ARMED'],
    ['STATUS STRIP', 'LIVE'],
    ['READY', ''],
  ];
  const hold = lines.length * STEP_MS + 260;

  useEffect(() => {
    if (phase !== 'on') return;
    // Panels and page motion wait for the log to finish (see Panel.module.css).
    const root = document.documentElement;
    root.style.setProperty('--boot', `${hold + 200}ms`);
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      // storage unavailable: the splash may show again next load, which is harmless
    }
    const out = () => setPhase((p) => (p === 'on' ? 'out' : p));
    const t = window.setTimeout(out, hold);
    window.addEventListener('keydown', out, { once: true });
    window.addEventListener('pointerdown', out, { once: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', out);
      window.removeEventListener('pointerdown', out);
    };
  }, [phase, hold]);

  useEffect(() => {
    if (phase !== 'out') return;
    const t = window.setTimeout(() => setPhase('done'), EXIT_MS);
    // Clear the delay once the entry motion it held back has had time to run.
    const clear = window.setTimeout(
      () => document.documentElement.style.removeProperty('--boot'),
      EXIT_MS + 1500
    );
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(clear);
    };
  }, [phase]);

  if (phase === 'done') return null;
  return (
    <div className={styles.boot} data-phase={phase} aria-hidden>
      <div className={styles.log}>
        {lines.map(([k, v], i) => (
          <div key={k} style={{ animationDelay: `${60 + i * STEP_MS}ms` }}>
            {i === 0 ? <b>{k}</b> : k}
            {v ? (
              <>
                {' '}
                <span className={styles.dots}>{'.'.repeat(Math.max(2, 18 - k.length))}</span>{' '}
                <span className={v === 'OK' || v === 'LIVE' ? styles.ok : undefined}>{v}</span>
              </>
            ) : null}
          </div>
        ))}
        <div className={styles.bar}>
          <i style={{ animationDuration: `${lines.length * STEP_MS + 60}ms` }} />
        </div>
      </div>
      <i className={styles.edge} />
    </div>
  );
}
