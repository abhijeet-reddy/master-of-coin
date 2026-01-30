/**
 * Currency codes and display information
 */

import { CurrencyCode, type Currency } from '@/types';

export const CURRENCIES: Currency[] = [
  { code: CurrencyCode.USD, name: 'US Dollar', symbol: '$' },
  { code: CurrencyCode.EUR, name: 'Euro', symbol: '€' },
  { code: CurrencyCode.GBP, name: 'British Pound', symbol: '£' },
  { code: CurrencyCode.INR, name: 'Indian Rupee', symbol: '₹' },
  { code: CurrencyCode.JPY, name: 'Japanese Yen', symbol: '¥' },
  { code: CurrencyCode.AUD, name: 'Australian Dollar', symbol: 'A$' },
  { code: CurrencyCode.CAD, name: 'Canadian Dollar', symbol: 'C$' },
];

export const getCurrencyByCode = (code: string): Currency | undefined => {
  return CURRENCIES.find((c) => c.code.toString() === code);
};

export const getCurrencySymbol = (code: string): string => {
  const currency = getCurrencyByCode(code);
  return currency?.symbol || code;
};
