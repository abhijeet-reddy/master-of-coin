// User preferences (GET/PUT /preferences). Theme stays on the client.

import { CurrencyCode } from './currency';

export enum DateFormat {
  DMY = 'DD/MM/YYYY',
  MDY = 'MM/DD/YYYY',
  ISO = 'YYYY-MM-DD',
}

export enum NumberLocale {
  EN_US = 'en-US',
  DE_DE = 'de-DE',
  FR_FR = 'fr-FR',
  EN_IN = 'en-IN',
}

/** ISO weekday the week starts on: 1 = Monday, 7 = Sunday. */
export enum WeekStart {
  MONDAY = 1,
  SUNDAY = 7,
}

export interface UserPreferences {
  default_currency: CurrencyCode | string;
  date_format: DateFormat;
  number_locale: NumberLocale | string;
  week_start: WeekStart;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  default_currency: CurrencyCode.EUR,
  date_format: DateFormat.DMY,
  number_locale: NumberLocale.EN_US,
  week_start: WeekStart.MONDAY,
};
