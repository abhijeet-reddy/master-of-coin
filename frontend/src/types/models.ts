// Domain model types

// Account types
export type AccountType =
  | 'CHECKING'
  | 'SAVINGS'
  | 'CREDIT_CARD'
  | 'INVESTMENT'
  | 'LOAN'
  | 'CASH'
  | 'OTHER';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  balance: string;
  transaction_count: number;
  notes?: string;
  created_at: string;
  updated_at: string;
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

// Transaction types
export interface TransactionSplit {
  person_id: string;
  person_name?: string;
  amount: string;
}

export interface Transaction {
  id: string;
  title: string;
  amount: string;
  date: string;
  account: {
    id: string;
    name: string;
    type: AccountType;
  };
  category?: {
    id: string;
    name: string;
    icon: string;
  };
  splits?: TransactionSplit[];
  notes?: string;
  user_share?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionRequest {
  title: string;
  amount: string;
  date: string;
  account_id: string;
  category_id?: string;
  notes?: string;
  splits?: {
    person_id: string;
    amount: string;
  }[];
}

export interface UpdateTransactionRequest {
  title?: string;
  amount?: string;
  date?: string;
  account_id?: string;
  category_id?: string;
  notes?: string;
  splits?: {
    person_id: string;
    amount: string;
  }[];
}

// Budget types
export type BudgetPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type BudgetStatus = 'OK' | 'WARNING' | 'EXCEEDED';

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
export interface NetWorth {
  total_assets: string;
  total_liabilities: string;
  net_worth: string;
  change_from_last_year?: string;
  change_percentage_yoy?: number;
}

export interface BudgetSummary {
  id: string;
  name: string;
  spent: string;
  limit: string;
  percentage: number;
  status: BudgetStatus;
}

export interface SpendingTrendPoint {
  month: string;
  amount: string;
}

export interface CategoryBreakdown {
  category_id: string;
  category_name: string;
  category_icon: string;
  amount: string;
  percentage: number;
}

export interface DashboardSummary {
  net_worth: NetWorth;
  accounts: Account[];
  budgets: BudgetSummary[];
  recent_transactions: Transaction[];
  spending_trend: SpendingTrendPoint[];
  category_breakdown: CategoryBreakdown[];
}
