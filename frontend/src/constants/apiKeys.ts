import type { ApiKeyStatus } from '@/models/apiKey';

// API Key status color mapping
export const API_KEY_STATUS_COLORS: Record<ApiKeyStatus, string> = {
  active: 'green',
  revoked: 'red',
  expired: 'orange',
};

// API Key expiration options (in days)
export const API_KEY_EXPIRATION_OPTIONS = [
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
  { label: 'Never', value: null },
] as const;
