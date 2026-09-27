import { apiClient } from './client';
import { DEFAULT_PREFERENCES, type UserPreferences } from './types/preferences';

type Wire = Partial<UserPreferences> & {
  defaultCurrency?: string;
  dateFormat?: UserPreferences['date_format'];
  numberLocale?: string;
  weekStart?: UserPreferences['week_start'];
};

/** Accept either snake_case or camelCase and fill anything missing with defaults. */
export function normalizePreferences(raw: Wire | null | undefined): UserPreferences {
  const r = raw ?? {};
  return {
    default_currency:
      r.default_currency ?? r.defaultCurrency ?? DEFAULT_PREFERENCES.default_currency,
    date_format: r.date_format ?? r.dateFormat ?? DEFAULT_PREFERENCES.date_format,
    number_locale: r.number_locale ?? r.numberLocale ?? DEFAULT_PREFERENCES.number_locale,
    week_start: r.week_start ?? r.weekStart ?? DEFAULT_PREFERENCES.week_start,
  };
}

export async function getPreferences(): Promise<UserPreferences> {
  const response = await apiClient.get<Wire>('/preferences');
  return normalizePreferences(response.data);
}

export async function updatePreferences(prefs: UserPreferences): Promise<UserPreferences> {
  const response = await apiClient.put<Wire>('/preferences', prefs);
  return normalizePreferences(response.data);
}
