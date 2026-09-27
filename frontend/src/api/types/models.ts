// Domain model types

import type { CurrencyCode } from './currency';

// Account types
export enum AccountType {
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
  CREDIT_CARD = 'CREDIT_CARD',
  INVESTMENT = 'INVESTMENT',
  LOAN = 'LOAN',
  CASH = 'CASH',
  DEBT = 'DEBT',
  GIFT_CARD = 'GIFT_CARD',
}

export interface Account {
  id: string;
  name: string;
  account_type: AccountType;
  currency: CurrencyCode;
  balance: number;
  is_active: boolean;
  /** Set when archived: hidden from pickers, still counted in net worth. */
  archived_at?: string | null;
  notes?: string;
}

// Category types
export interface Category {
  id: string;
  name: string;
  /** Emoji; null or empty when none was chosen. */
  icon: string | null;
  /** `#RRGGBB`; null or empty when none was chosen. */
  color: string | null;
  parent_id?: string | null;
  is_excluded_from_analysis?: boolean;
}

// Person types
export interface Person {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  debt_summary?: DebtSummary;
  transaction_count: number;
}

export interface DebtSummary {
  owes_me: string;
  i_owe: string;
  net: string;
}

/** GET /people/:id/debts: the net debt only (positive: they owe me). */
export interface PersonDebt {
  person_id: string;
  person_name: string;
  debt_amount: string;
}

// Transaction split types

/** Split data sent to the API when creating/editing */
export interface TransactionSplitRequest {
  person_id: string;
  person_name?: string;
  amount: string;
}

/** Split data returned from the API (includes server-assigned id) */
export interface TransactionSplitResponse extends TransactionSplitRequest {
  id: string;
}

/** Alias for backward compatibility - use TransactionSplitResponse for API data */
export type TransactionSplit = TransactionSplitResponse;

// Expense participant in a "paid by others" transaction
export interface ExpenseParticipant {
  name: string;
  external_user_id?: string;
  paid_share: string;
  owed_share: string;
}

// Debt metadata for "paid by others" transactions
export interface DebtMetadata {
  payer_person_id: string;
  payer_person_name: string;
  total_cost: string;
  expense_participants?: ExpenseParticipant[] | null;
}

// Base transaction from API
export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id?: string;
  title: string;
  amount: string;
  date: string;
  notes?: string;
  splits?: TransactionSplit[];
  user_share?: string;
  debt_metadata?: DebtMetadata | null;
  transfer_info?: TransferInfo;
  deleted_at?: string;
  permanent_delete_at?: string;
  created_at: string;
  updated_at: string;
}

// Transfer metadata attached to transactions that are part of a transfer
export interface TransferInfo {
  transfer_id: string;
  linked_account_id: string;
  linked_account_name: string;
  // Signed amount of the linked (counterpart) leg, as a string. With this
  // transaction's own amount it lets the UI show unequal-leg transfers.
  linked_amount: string;
}

// Enriched transaction
export interface EnrichedTransaction {
  id: string;
  title: string;
  amount: string;
  date: string;
  account: {
    id: string;
    name: string;
    type: AccountType;
    currency: CurrencyCode;
  };
  category?: {
    id: string;
    name: string;
    icon: string;
    is_excluded_from_analysis?: boolean;
  };
  splits?: TransactionSplit[];
  notes?: string;
  user_share?: string;
  debt_metadata?: DebtMetadata | null;
  transfer_info?: TransferInfo;
  deleted_at?: string;
  permanent_delete_at?: string;
  created_at: string;
  updated_at: string;
}

// Transfer request/response types
export interface CreateTransferRequest {
  from_account_id: string;
  to_account_id: string;
  from_amount: number;
  to_amount?: number;
  exchange_rate?: number;
  title?: string;
  date: string;
  notes?: string;
  category_id?: string;
}

export interface TransferResponse {
  id: string;
  from_transaction: Transaction;
  to_transaction: Transaction;
  exchange_rate: string;
  created_at: string;
}

// Request to convert an existing transaction into a transfer.
// Direction is inferred from the transaction's amount sign, so it is never sent.
export interface ConvertToTransferRequest {
  account_id: string;
  // When present, LINK this existing transaction on the counterpart account as
  // the other leg instead of creating a new one. Its own amount is kept.
  counterpart_transaction_id?: string;
  // Cross-currency only: the absolute amount on the counterpart account's leg.
  counterpart_amount?: number;
  // Alternative to counterpart_amount for cross-currency conversions.
  exchange_rate?: number;
}

// An existing transaction on the counterpart account offered as the other leg
// when converting a transaction into a transfer.
export interface TransferCandidate {
  id: string;
  title: string;
  amount: string;
  date: string;
}

// Candidate-search response: a capped list plus the TOTAL number of matches, so
// the UI can show "showing 5 of 12". total > candidates.length means truncated.
export interface ConvertCandidatesResponse {
  candidates: TransferCandidate[];
  total: number;
}

export interface CreateTransactionRequest {
  title: string;
  amount: number; // Backend expects f64 (number)
  date: string;
  account_id: string;
  category_id?: string;
  notes?: string;
  splits?: {
    person_id: string;
    amount: number; // Backend expects f64 (number)
  }[];
}

// Payer mode for transaction form
export type PayerMode = 'self' | 'other';

// Request for creating a "paid by others" (debt) transaction
export interface CreateDebtTransactionRequest {
  payer_person_id: string;
  currency?: CurrencyCode;
  category_id?: string;
  title: string;
  amount: number;
  date: string;
  notes?: string;
}

// Request for updating expense details on a debt transaction
export interface UpdateExpenseDetailsRequest {
  total_cost: number;
  expense_participants: ExpenseParticipantInput[];
}

// Input DTO for an expense participant (matches backend ExpenseParticipantInput)
export interface ExpenseParticipantInput {
  name: string;
  external_user_id?: string;
  paid_share: string;
  owed_share: string;
}

// Default values for pre-filling the transaction form (used by duplicate)
export interface TransactionFormDefaultValues {
  title?: string;
  amount?: string;
  transaction_type?: 'income' | 'expense';
  account_id?: string;
  category_id?: string;
  notes?: string;
  payer_mode?: PayerMode;
  payer_person_id?: string;
  payer_currency?: string;
}

export interface UpdateTransactionRequest {
  title?: string;
  amount?: number; // Backend expects f64 (number)
  date?: string;
  account_id?: string;
  category_id?: string;
  notes?: string;
  splits?: {
    person_id: string;
    amount: number; // Backend expects f64 (number)
  }[];
}

// Budget types
export type BudgetPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type BudgetStatusType = 'OK' | 'WARNING' | 'EXCEEDED';

/**
 * What a budget counts. The backend honours `category_id` and a single
 * `account_id`; with neither it counts all spending outside categories that
 * are excluded from analysis.
 */
export interface BudgetFilters {
  category_id?: string;
  account_id?: string;
}

/** A stored limit for a span of time (`GET /budgets/:id/ranges`). */
export interface BudgetRange {
  id: string;
  budget_id: string;
  limit_amount: string;
  period: BudgetPeriod;
  /** `YYYY-MM-DD`, inclusive. */
  start_date: string;
  /** `YYYY-MM-DD`, inclusive; null means open ended. */
  end_date: string | null;
}

/**
 * A budget as `GET /budgets` reports it. When a range is active,
 * `active_range` carries the CURRENT PERIOD window (not the stored range
 * dates) and the spending fields are filled in.
 */
export interface Budget {
  id: string;
  user_id?: string;
  name: string;
  filters: BudgetFilters;
  active_range?: BudgetRange | null;
  current_spending?: string | null;
  percentage_used?: number | null;
  /** Negative when over the limit. */
  remaining?: string | null;
  status?: BudgetHealth | null;
  /** Days left in the period, counting today; 0 once it has ended. */
  days_left?: number | null;
  currency?: string | null;
}

export interface CreateBudgetRequest {
  name: string;
  filters: BudgetFilters;
}

export type UpdateBudgetRequest = Partial<CreateBudgetRequest>;

/** Body for `POST /budgets/:id/ranges` and `PUT /budgets/:id/ranges/:rid`. */
export interface BudgetRangeRequest {
  limit_amount: number;
  period: BudgetPeriod;
  start_date: string;
  end_date: string | null;
}

// Dashboard types
// Raw budget status from backend API
export interface BudgetStatus {
  budget_id: string;
  current_spending: string;
  limit_amount: string;
  percentage_used: number;
  is_over_budget: boolean;
}

/** Budget health for the current period (`GET /dashboard`, snake_case on the wire). */
export enum BudgetHealth {
  OnTrack = 'on_track',
  Warning = 'warning',
  Over = 'over',
}

/** A budget's current period as `GET /dashboard` reports it, in the budget's own currency. */
export interface DashboardBudgetStatus extends BudgetStatus {
  name: string;
  remaining: string;
  status: BudgetHealth;
  period: BudgetPeriod;
  /** `YYYY-MM-DD`, inclusive. */
  period_start: string;
  /** `YYYY-MM-DD`, inclusive. */
  period_end: string;
  days_left: number;
  currency: string;
}

// Enriched budget status with full details
export interface EnrichedBudgetStatus {
  budget_id: string;
  budget_name: string;
  limit_amount: string;
  current_spending: string;
  percentage: number;
  status: BudgetStatusType;
  period: BudgetPeriod;
  start_date: string;
  end_date?: string;
}

export interface CategoryBreakdownItem {
  category_id?: string;
  category_name?: string;
  total: string;
  percentage: number;
}

export interface SpendingTrendPoint {
  date: string;
  amount: number;
  month?: string;
}

export interface DebtOverview {
  total_owed_to_me: string;
  total_i_owe: string;
}

export interface DashboardSummary {
  net_worth: string;
  /** Currency every total in the summary is expressed in (the user's default). */
  currency: string;
  recent_transactions: Transaction[];
  budget_statuses: DashboardBudgetStatus[];
  category_breakdown: CategoryBreakdownItem[];
  top_spending_categories: CategoryBreakdownItem[];
  debt_overview: DebtOverview;
}
