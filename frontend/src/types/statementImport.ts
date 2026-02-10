/** Statement import types */

export interface ParsedTransaction {
  temp_id: string;
  title: string;
  amount: string;
  date: string;
  category_id?: string;
  notes?: string;
  original_currency?: string;
  original_amount?: string;
  is_valid: boolean;
  validation_errors?: string[];
  is_potential_duplicate: boolean;
  duplicate_match?: DuplicateMatch;
}

export interface DuplicateMatch {
  transaction_id: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  matched_on: string[];
  matched_date: string;
}

export interface ImportSummary {
  total: number;
  income: number;
  expenses: number;
  duplicates: number;
  invalid: number;
}

export interface ParseResponse {
  success: boolean;
  data: {
    account_id: string;
    transactions: ParsedTransaction[];
    summary: ImportSummary;
  };
  errors?: string[];
}

export interface BulkCreateRequest {
  account_id: string;
  transactions: Array<{
    account_id: string;
    category_id?: string;
    title: string;
    amount: number;
    date: string;
    notes?: string;
  }>;
}

export interface BulkCreateResponse {
  success: boolean;
  data: {
    created: number;
    failed: number;
    transactions: any[]; // TransactionResponse[]
    errors?: Array<{
      index: number;
      error: string;
    }>;
  };
}
