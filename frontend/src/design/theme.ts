/**
 * Theme and motion state, kept outside React so the pre-paint script in
 * index.html and the app agree. `:root` gets a `dark`/`light` class plus
 * `data-theme`, and `rm` when the OS asks for reduced motion.
 */

export enum ThemePreference {
  System = 'system',
  Dark = 'dark',
  Light = 'light',
}

export enum ResolvedTheme {
  Dark = 'dark',
  Light = 'light',
}

export const THEME_STORAGE_KEY = 'moc-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const LIGHT_QUERY = '(prefers-color-scheme: light)';
const MOTION_QUERY = '(prefers-reduced-motion: reduce)';

type Listener = () => void;
const listeners = new Set<Listener>();

function media(query: string): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query)
    : null;
}

function isPreference(value: unknown): value is ThemePreference {
  return Object.values(ThemePreference).includes(value as ThemePreference);
}

export function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : ThemePreference.System;
  } catch {
    return ThemePreference.System;
  }
}

export function resolveTheme(pref: ThemePreference = getThemePreference()): ResolvedTheme {
  if (pref === ThemePreference.Dark) return ResolvedTheme.Dark;
  if (pref === ThemePreference.Light) return ResolvedTheme.Light;
  // Dark is the default when the OS expresses no preference.
  return media(LIGHT_QUERY)?.matches && !media(DARK_QUERY)?.matches
    ? ResolvedTheme.Light
    : ResolvedTheme.Dark;
}

export function prefersReducedMotion(): boolean {
  return media(MOTION_QUERY)?.matches ?? false;
}

export function applyTheme(): void {
  const root = document.documentElement;
  const theme = resolveTheme();
  root.classList.remove(ResolvedTheme.Dark, ResolvedTheme.Light);
  root.classList.add(theme);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  root.classList.toggle('rm', prefersReducedMotion());
}

function emit(): void {
  applyTheme();
  listeners.forEach((fn) => fn());
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    if (pref === ThemePreference.System) localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Storage can be unavailable (private mode). The theme still applies for this visit.
  }
  emit();
}

const WIPE_MS = 600;
const WIPE_EASE = 'cubic-bezier(0.77, 0, 0.175, 1)';

type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> };
};

/**
 * Flip dark/light. Where View Transitions exist, the new theme wipes down the screen
 * behind an accent edge (as in the Telemetry mock); otherwise it switches instantly.
 */
export function toggleTheme(): void {
  const next = resolveTheme() === ResolvedTheme.Dark ? ThemePreference.Light : ThemePreference.Dark;
  const doc = document as ViewTransitionDoc;
  if (!doc.startViewTransition || prefersReducedMotion()) {
    setThemePreference(next);
    return;
  }
  const vt = doc.startViewTransition(() => setThemePreference(next));
  vt.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0 0)'] },
        { duration: WIPE_MS, easing: WIPE_EASE, pseudoElement: '::view-transition-new(root)' }
      );
      const edge = document.createElement('i');
      edge.className = 'moc-wipe-edge';
      edge.setAttribute('aria-hidden', 'true');
      document.body.append(edge);
      edge.animate(
        [{ transform: 'translateY(-2px)' }, { transform: `translateY(${window.innerHeight}px)` }],
        { duration: WIPE_MS, easing: WIPE_EASE }
      ).onfinish = () => edge.remove();
    })
    .catch(() => undefined);
}

let wired = false;
/** Call once at startup: applies the theme and follows OS changes. */
export function initTheme(): void {
  applyTheme();
  if (wired) return;
  wired = true;
  media(DARK_QUERY)?.addEventListener('change', emit);
  media(MOTION_QUERY)?.addEventListener('change', emit);
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_STORAGE_KEY) emit();
  });
}

export function subscribeTheme(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
