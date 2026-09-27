/**
 * Preferences context: the user's server-side display preferences plus the
 * formatters bound to them. The app root feeds it from GET /preferences; until
 * that loads (or when it fails) the defaults apply: EUR, DD/MM/YYYY, en-US, Monday.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_PREFERENCES, type UserPreferences } from '@/api/types/preferences';
import { createFormatters, type Formatters } from './format';

export interface PreferencesValue {
  prefs: UserPreferences;
  fmt: Formatters;
  /** True while the server value has not arrived and defaults are in use. */
  isDefault: boolean;
}

const defaultValue: PreferencesValue = {
  prefs: DEFAULT_PREFERENCES,
  fmt: createFormatters(DEFAULT_PREFERENCES),
  isDefault: true,
};

const PreferencesContext = createContext<PreferencesValue>(defaultValue);

export function PreferencesProvider({
  prefs,
  children,
}: {
  prefs: UserPreferences | undefined;
  children: ReactNode;
}) {
  const value = useMemo<PreferencesValue>(
    () => (prefs ? { prefs, fmt: createFormatters(prefs), isDefault: false } : defaultValue),
    [prefs]
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePreferences(): PreferencesValue {
  return useContext(PreferencesContext);
}
