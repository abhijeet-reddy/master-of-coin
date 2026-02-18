/**
 * Application-wide default values
 */

import { AccountType, CurrencyCode } from '@/types';

export const DEFAULT_CURRENCY = CurrencyCode.EUR;
export const DEFAULT_DATE_FORMAT = 'DD/MM/YYYY';
export const DEFAULT_NUMBER_FORMAT = 'en-US';

/**
 * DEBT pseudo-account display info for "paid by others" transactions.
 * DEBT accounts are hidden from the account list, so when enriching
 * transactions we use this constant for display purposes.
 */
export const DEBT_ACCOUNT_INFO = {
  name: 'Debt',
  type: AccountType.DEBT,
  currency: DEFAULT_CURRENCY,
} as const;
