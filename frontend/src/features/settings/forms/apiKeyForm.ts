import { z } from 'zod';
import { ScopePermission, type ApiKey } from '@/api/types/apiKey';
import { emptyScopes, ExpiryChoice, hasAnyScope, normalizeScopes } from '../lib/apiKeyModel';

export const KEY_NAME_MAX = 255;

const perms = z.array(z.enum(ScopePermission));

const scopesSchema = z.object({
  transactions: perms,
  accounts: perms,
  budgets: perms,
  categories: perms,
  people: perms,
});

export const apiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name the key')
    .max(KEY_NAME_MAX, `At most ${KEY_NAME_MAX} characters`),
  expiry: z.enum(ExpiryChoice),
  scopes: scopesSchema.refine(
    (s) => hasAnyScope(s),
    'Give the key access to at least one resource'
  ),
});
export type ApiKeyValues = z.infer<typeof apiKeySchema>;

export const createKeyDefaults = (): ApiKeyValues => ({
  name: '',
  expiry: ExpiryChoice.Days90,
  scopes: emptyScopes(),
});

export const editKeyDefaults = (k: ApiKey): ApiKeyValues => ({
  name: k.name,
  expiry: ExpiryChoice.Keep,
  scopes: normalizeScopes(k.scopes),
});
