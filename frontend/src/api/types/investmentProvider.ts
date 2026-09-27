// Investment provider types matching backend DTOs

/** Supported investment provider types */
export enum InvestmentProviderType {
  TRADING_212 = 'TRADING_212',
}

/** Investment provider record (from GET /investment-providers) */
export interface InvestmentProvider {
  id: string;
  user_id: string;
  account_id: string;
  provider_type: InvestmentProviderType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Request to connect a brokerage provider (POST /investment-providers) */
export interface ConnectInvestmentProviderRequest {
  account_id: string;
  provider_type: InvestmentProviderType;
  api_key: string;
  api_secret: string;
  environment?: string;
}
