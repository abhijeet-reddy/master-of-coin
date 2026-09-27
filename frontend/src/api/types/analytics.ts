// Server-side aggregates (GET /analytics/*). Amounts are decimal strings in the
// user's default currency.

export interface MonthlyTotals {
  /** `YYYY-MM` */
  month: string;
  income: string;
  spend: string;
  net: string;
}

export interface NetWorthPoint {
  date: string;
  total: string;
  /** Per account type (`CHECKING`, `CREDIT_CARD`...), decimal strings. */
  by_type: Record<string, string>;
}

export interface SpendingTrendDay {
  date: string;
  amount: string;
}
