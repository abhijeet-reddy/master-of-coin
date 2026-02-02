import { DEFAULT_CURRENCY } from '@/constants';
import type { CurrencyCode } from '@/types';

/**
 * Format a number as currency
 * @param amount - The amount to format
 * @param currency - The currency code
 * @returns Formatted currency string
 */
export const formatCurrency = (
  amount: number,
  currency: CurrencyCode = DEFAULT_CURRENCY
): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

/**
 * Parse a currency string to a number
 * @param currencyString - Currency string (e.g., "$1,234.56")
 * @returns Parsed number
 */
export const parseCurrency = (currencyString: string): number => {
  return parseFloat(currencyString.replace(/[^0-9.-]+/g, ''));
};
