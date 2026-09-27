/**
 * Currency types
 * Must match backend CurrencyCode enum in backend/src/types/currency_code.rs
 */

export enum CurrencyCode {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  INR = 'INR',
  JPY = 'JPY',
  AUD = 'AUD',
  CAD = 'CAD',
}

export interface Currency {
  code: CurrencyCode;
  name: string;
  symbol: string;
}
