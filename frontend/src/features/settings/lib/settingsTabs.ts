/** The Settings tabs, as they appear in `?tab=`. */
export enum SettingsTab {
  Profile = 'profile',
  Preferences = 'preferences',
  Security = 'security',
  Integrations = 'integrations',
  ApiKeys = 'api-keys',
  About = 'about',
}

export const SETTINGS_TABS = [
  SettingsTab.Profile,
  SettingsTab.Preferences,
  SettingsTab.Security,
  SettingsTab.Integrations,
  SettingsTab.ApiKeys,
  SettingsTab.About,
] as const;

export const SETTINGS_TAB_LABEL: Record<SettingsTab, string> = {
  [SettingsTab.Profile]: 'Profile',
  [SettingsTab.Preferences]: 'Preferences',
  [SettingsTab.Security]: 'Security',
  [SettingsTab.Integrations]: 'Integrations',
  [SettingsTab.ApiKeys]: 'API keys',
  [SettingsTab.About]: 'About',
};

/** Tab names older links use. The Splitwise OAuth callback still lands on `?tab=split`. */
const LEGACY: Record<string, SettingsTab> = {
  split: SettingsTab.Integrations,
  integrations: SettingsTab.Integrations,
  api_keys: SettingsTab.ApiKeys,
  apikeys: SettingsTab.ApiKeys,
};

/** Map a raw `?tab=` value, legacy names included, onto a tab. */
export function normalizeTab(raw: unknown): unknown {
  const v: unknown = Array.isArray(raw) ? (raw as unknown[])[0] : raw;
  return typeof v === 'string' && v in LEGACY ? LEGACY[v] : v;
}

/** What the Splitwise OAuth callback reports in `?status=`. */
export enum OAuthStatus {
  Connected = 'connected',
  Error = 'error',
}
