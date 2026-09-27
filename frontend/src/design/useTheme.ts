import { useSyncExternalStore } from 'react';
import {
  getThemePreference,
  prefersReducedMotion,
  resolveTheme,
  setThemePreference,
  subscribeTheme,
  toggleTheme,
  type ResolvedTheme,
  type ThemePreference,
} from './theme';

interface ThemeState {
  preference: ThemePreference;
  theme: ResolvedTheme;
  reducedMotion: boolean;
  setPreference: (pref: ThemePreference) => void;
  toggle: () => void;
}

// Snapshot is a string so React can compare it cheaply.
const snapshot = () => `${getThemePreference()}|${resolveTheme()}|${prefersReducedMotion()}`;

export function useTheme(): ThemeState {
  const snap = useSyncExternalStore(subscribeTheme, snapshot, snapshot);
  const [preference, theme, rm] = snap.split('|');
  return {
    preference: preference as ThemePreference,
    theme: theme as ResolvedTheme,
    reducedMotion: rm === 'true',
    setPreference: setThemePreference,
    toggle: toggleTheme,
  };
}
