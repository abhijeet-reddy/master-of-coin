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
 * Format a date string for display
 * @param dateString - ISO date string
 * @param format - Format type ('short' | 'long' | 'full')
 * @returns Formatted date string
 */
export const formatDate = (
  dateString: string,
  format: 'short' | 'long' | 'full' = 'short'
): string => {
  const date = new Date(dateString);

  switch (format) {
    case 'short':
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    case 'long':
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    case 'full':
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    default:
      return date.toLocaleDateString('en-US');
  }
};

/**
 * Parse a currency string to a number
 * @param currencyString - Currency string (e.g., "$1,234.56")
 * @returns Parsed number
 */
export const parseCurrency = (currencyString: string): number => {
  return parseFloat(currencyString.replace(/[^0-9.-]+/g, ''));
};
