/** API key scopes, expiry choices and the create/update payloads. Pure; no React. */
import {
  ApiKeyStatus,
  ScopePermission,
  type ApiKey,
  type ApiKeyScopes,
  type CreateApiKeyRequest,
  type UpdateApiKeyRequest,
} from '@/api/types/apiKey';
import { Tone } from '@/ui/types';

export type ScopeResource = keyof ApiKeyScopes;

export const RESOURCES: ReadonlyArray<{ key: ScopeResource; label: string }> = [
  { key: 'transactions', label: 'Transactions' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'categories', label: 'Categories' },
  { key: 'people', label: 'People' },
];

export const PERMISSIONS = [ScopePermission.Read, ScopePermission.Write] as const;

export const emptyScopes = (): ApiKeyScopes => ({
  transactions: [],
  accounts: [],
  budgets: [],
  categories: [],
  people: [],
});

/** Copy with one permission switched on or off, kept in read-then-write order. */
export function toggleScope(
  scopes: ApiKeyScopes,
  resource: ScopeResource,
  permission: ScopePermission,
  on: boolean
): ApiKeyScopes {
  const set = new Set(scopes[resource]);
  if (on) set.add(permission);
  else set.delete(permission);
  return { ...scopes, [resource]: PERMISSIONS.filter((p) => set.has(p)) };
}

export const hasAnyScope = (s: ApiKeyScopes) => RESOURCES.some((r) => s[r.key].length > 0);

export const sameScopes = (a: ApiKeyScopes, b: ApiKeyScopes) =>
  RESOURCES.every((r) => PERMISSIONS.every((p) => a[r.key].includes(p) === b[r.key].includes(p)));

/** Missing resources in a stored key read as no access. */
export const normalizeScopes = (s: Partial<ApiKeyScopes> | undefined): ApiKeyScopes => ({
  ...emptyScopes(),
  ...Object.fromEntries(RESOURCES.map((r) => [r.key, [...(s?.[r.key] ?? [])]])),
});

/** "Transactions read and write, Accounts read" */
export function scopeSummary(s: ApiKeyScopes): string {
  const parts = RESOURCES.filter((r) => s[r.key].length).map((r) => {
    const read = s[r.key].includes(ScopePermission.Read);
    const write = s[r.key].includes(ScopePermission.Write);
    return `${r.label} ${read && write ? 'read and write' : read ? 'read' : 'write'}`;
  });
  return parts.length ? parts.join(', ') : 'No access';
}

/**
 * Expiry choices. `Keep` is edit-only: the server treats a missing `expires_in_days` as no
 * change, and has no way to clear an expiry, so `Never` is create-only.
 */
export enum ExpiryChoice {
  Keep = 'keep',
  Days30 = '30',
  Days60 = '60',
  Days90 = '90',
  Never = 'never',
}

export const EXPIRY_LABEL: Record<ExpiryChoice, string> = {
  [ExpiryChoice.Keep]: 'Keep current expiry',
  [ExpiryChoice.Days30]: '30 days',
  [ExpiryChoice.Days60]: '60 days',
  [ExpiryChoice.Days90]: '90 days',
  [ExpiryChoice.Never]: 'Never',
};

export const CREATE_EXPIRY = [
  ExpiryChoice.Days30,
  ExpiryChoice.Days60,
  ExpiryChoice.Days90,
  ExpiryChoice.Never,
] as const;

export const EDIT_EXPIRY = [
  ExpiryChoice.Keep,
  ExpiryChoice.Days30,
  ExpiryChoice.Days60,
  ExpiryChoice.Days90,
] as const;

/** Days for a choice; null for Never and Keep. */
export const expiryDays = (c: ExpiryChoice): number | null =>
  c === ExpiryChoice.Keep || c === ExpiryChoice.Never ? null : Number(c);

export function createPayload(
  name: string,
  expiry: ExpiryChoice,
  scopes: ApiKeyScopes
): CreateApiKeyRequest {
  return { name: name.trim(), expires_in_days: expiryDays(expiry), scopes };
}

/** Only what changed. Expiry is sent only when a new one was picked, so an edit never moves it. */
export function updatePayload(
  before: ApiKey,
  name: string,
  expiry: ExpiryChoice,
  scopes: ApiKeyScopes
): UpdateApiKeyRequest {
  const out: UpdateApiKeyRequest = {};
  if (name.trim() !== before.name) out.name = name.trim();
  const days = expiryDays(expiry);
  if (days != null) out.expires_in_days = days;
  if (!sameScopes(scopes, normalizeScopes(before.scopes))) out.scopes = scopes;
  return out;
}

export const STATUS_LABEL: Record<ApiKeyStatus, string> = {
  [ApiKeyStatus.Active]: 'Active',
  [ApiKeyStatus.Revoked]: 'Revoked',
  [ApiKeyStatus.Expired]: 'Expired',
};

export const STATUS_TONE: Record<ApiKeyStatus, Tone> = {
  [ApiKeyStatus.Active]: Tone.Pos,
  [ApiKeyStatus.Revoked]: Tone.Neutral,
  [ApiKeyStatus.Expired]: Tone.Warn,
};

/** Active keys first, then newest. */
export function sortKeys(keys: readonly ApiKey[]): ApiKey[] {
  const rank = (k: ApiKey) => (k.status === ApiKeyStatus.Active ? 0 : 1);
  return [...keys].sort((a, b) => rank(a) - rank(b) || b.created_at.localeCompare(a.created_at));
}
