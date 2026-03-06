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
}

export interface Account {
  id: string;
  name: string;
  account_type: AccountType;
  currency: CurrencyCode;
  balance: number;
  is_active: boolean;
  notes?: string;
}

// Category types
export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  parent_category_id?: string;
  transaction_count: number;
  created_at: string;
}

// Person types
export interface Person {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  debt_summary?: DebtSummary;
  transaction_count: number;
  created_at: string;
}

export interface DebtSummary {
  owes_me: string;
  i_owe: string;
  net: string;
}

export interface PersonDebtDetail {
  person: Person;
  debt_summary: DebtSummary;
  transactions: DebtTransaction[];
}

export interface DebtTransaction {
  id: string;
  title: string;
  total_amount: string;
  split_amount: string;
  date: string;
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
  created_at: string;
  updated_at: string;
}

// Transfer metadata attached to transactions that are part of a transfer
export interface TransferInfo {
  transfer_id: string;
  linked_account_id: string;
  linked_account_name: string;
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
  };
  splits?: TransactionSplit[];
  notes?: string;
  user_share?: string;
  debt_metadata?: DebtMetadata | null;
  transfer_info?: TransferInfo;
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

export interface BudgetFilters {
  category_id?: string;
  account_ids?: string[];
  min_amount?: string;
  max_amount?: string;
}

export interface BudgetRange {
  id: string;
  limit_amount: string;
  period: BudgetPeriod;
  start_date: string;
  end_date?: string;
}

export interface Budget {
  id: string;
  name: string;
  filters: BudgetFilters;
  active_range?: BudgetRange;
  current_spending?: string;
  percentage?: number;
  status?: BudgetStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateBudgetRequest {
  name: string;
  filters: BudgetFilters;
  ranges: {
    limit_amount: string;
    period: BudgetPeriod;
    start_date: string;
    end_date?: string;
  }[];
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

export interface DashboardSummary {
  net_worth: string;
  recent_transactions: Transaction[];
  budget_statuses: BudgetStatus[];
  category_breakdown: CategoryBreakdownItem[];
  top_spending_categories: CategoryBreakdownItem[];
}
