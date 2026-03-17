// API response types

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    timestamp: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface QueryParams {
  month?: string;
  start_date?: string;
  end_date?: string;
  category?: string;
  category_id?: string;
  account?: string;
  account_id?: string;
  person_id?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}
