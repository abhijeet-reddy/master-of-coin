import { describe, expect, it } from 'vitest';
import { ApiErrorKind, ApiError } from '@/api/client';
import { ApiKeyStatus, ScopePermission, type ApiKey } from '@/api/types/apiKey';
import { DateFormat, NumberLocale, WeekStart } from '@/api/types/preferences';
import {
  apiKeySchema,
  createKeyDefaults,
  editKeyDefaults,
} from '@/features/settings/forms/apiKeyForm';
import {
  passwordSchema,
  preferencesSchema,
  profilePatch,
  profileSchema,
} from '@/features/settings/forms/accountForms';
import { driftDefaults, driftSchema } from '@/features/settings/forms/integrationForms';
import {
  createPayload,
  emptyScopes,
  ExpiryChoice,
  hasAnyScope,
  normalizeScopes,
  scopeSummary,
  sortKeys,
  toggleScope,
  updatePayload,
} from '@/features/settings/lib/apiKeyModel';
import { SESSION_REQUIRED, writeErrorMessage } from '@/features/settings/lib/settingsErrors';
import { normalizeTab, SettingsTab } from '@/features/settings/lib/settingsTabs';

const { Read, Write } = ScopePermission;

const key = (over: Partial<ApiKey> = {}): ApiKey => ({
  id: 'k1',
  name: 'Home',
  key_prefix: 'moc_abc',
  scopes: { ...emptyScopes(), transactions: [Read] },
  status: ApiKeyStatus.Active,
  expires_at: '2026-12-01T00:00:00Z',
  last_used_at: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  ...over,
});

describe('api key scopes', () => {
  it('toggles permissions in read, write order', () => {
    let s = toggleScope(emptyScopes(), 'accounts', Write, true);
    s = toggleScope(s, 'accounts', Read, true);
    expect(s.accounts).toEqual([Read, Write]);
    expect(toggleScope(s, 'accounts', Read, false).accounts).toEqual([Write]);
    expect(hasAnyScope(emptyScopes())).toBe(false);
    expect(hasAnyScope(s)).toBe(true);
  });

  it('summarises scopes and fills missing resources', () => {
    const s = normalizeScopes({ transactions: [Read, Write], people: [Read] });
    expect(s.budgets).toEqual([]);
    expect(scopeSummary(s)).toBe('Transactions read and write, People read');
    expect(scopeSummary(emptyScopes())).toBe('No access');
  });
});

describe('api key payloads', () => {
  it('creates with days, or null for never', () => {
    const scopes = { ...emptyScopes(), budgets: [Read] };
    expect(createPayload(' CI ', ExpiryChoice.Days30, scopes)).toEqual({
      name: 'CI',
      expires_in_days: 30,
      scopes,
    });
    expect(createPayload('CI', ExpiryChoice.Never, scopes).expires_in_days).toBeNull();
  });

  it('never sends an expiry on edit unless a new one is picked', () => {
    const k = key();
    const same = editKeyDefaults(k);
    expect(same.expiry).toBe(ExpiryChoice.Keep);
    expect(updatePayload(k, same.name, same.expiry, same.scopes)).toEqual({});
    expect(updatePayload(k, 'Renamed', ExpiryChoice.Keep, same.scopes)).toEqual({
      name: 'Renamed',
    });
    expect(updatePayload(k, k.name, ExpiryChoice.Days60, same.scopes)).toEqual({
      expires_in_days: 60,
    });
    const scopes = toggleScope(same.scopes, 'people', Write, true);
    expect(updatePayload(k, k.name, ExpiryChoice.Keep, scopes)).toEqual({ scopes });
  });

  it('validates name and requires a scope', () => {
    expect(apiKeySchema.safeParse(createKeyDefaults()).success).toBe(false);
    const ok = {
      ...createKeyDefaults(),
      name: 'CI',
      scopes: { ...emptyScopes(), accounts: [Read] },
    };
    expect(apiKeySchema.safeParse(ok).success).toBe(true);
    const noScope = apiKeySchema.safeParse({ ...ok, scopes: emptyScopes() });
    expect(noScope.error?.issues[0].path).toEqual(['scopes']);
  });

  it('sorts active keys first, newest first', () => {
    const list = sortKeys([
      key({ id: 'a', status: ApiKeyStatus.Revoked, created_at: '2026-09-20' }),
      key({ id: 'b', created_at: '2026-09-01' }),
      key({ id: 'c', created_at: '2026-09-10' }),
    ]);
    expect(list.map((k) => k.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('settings tabs', () => {
  it('maps legacy tab names', () => {
    expect(normalizeTab('split')).toBe(SettingsTab.Integrations);
    expect(normalizeTab(['split'])).toBe(SettingsTab.Integrations);
    expect(normalizeTab('about')).toBe('about');
    expect(normalizeTab(undefined)).toBeUndefined();
  });

  it('explains a 403 as needing a session', () => {
    expect(writeErrorMessage(new ApiError(ApiErrorKind.Forbidden, 'nope', 403))).toBe(
      SESSION_REQUIRED
    );
    expect(
      writeErrorMessage(new ApiError(ApiErrorKind.Validation, 'Name cannot be blank', 422))
    ).toBe('Name cannot be blank');
  });
});

describe('account forms', () => {
  it('validates the profile and sends only changes', () => {
    expect(profileSchema.safeParse({ name: '', email: 'a@b.co' }).success).toBe(false);
    expect(profileSchema.safeParse({ name: 'A', email: 'nope' }).success).toBe(false);
    const user = { id: '1', username: 'u', email: 'a@b.co', name: 'A', created_at: '' };
    expect(profilePatch({ name: 'A', email: 'a@b.co' }, user)).toEqual({});
    expect(profilePatch({ name: ' B ', email: 'a@b.co' }, user)).toEqual({ name: 'B' });
  });

  it('checks password length and confirmation', () => {
    const base = {
      current_password: 'oldpassword',
      new_password: 'newpassword',
      confirm: 'newpassword',
    };
    expect(passwordSchema.safeParse(base).success).toBe(true);
    expect(
      passwordSchema.safeParse({ ...base, new_password: 'short', confirm: 'short' }).success
    ).toBe(false);
    expect(passwordSchema.safeParse({ ...base, confirm: 'other' }).error?.issues[0].path).toEqual([
      'confirm',
    ]);
    expect(
      passwordSchema.safeParse({ ...base, new_password: 'oldpassword', confirm: 'oldpassword' })
        .success
    ).toBe(false);
  });

  it('accepts the server preference values', () => {
    expect(
      preferencesSchema.safeParse({
        default_currency: 'GBP',
        date_format: DateFormat.ISO,
        number_locale: NumberLocale.DE_DE,
        week_start: WeekStart.SUNDAY,
      }).success
    ).toBe(true);
    expect(
      preferencesSchema.safeParse({
        default_currency: 'GBP',
        date_format: 'D/M',
        number_locale: 'en-US',
        week_start: 3,
      }).success
    ).toBe(false);
  });

  it('defaults drift to the last 90 days and rejects a reversed window', () => {
    const d = driftDefaults(new Date(2026, 8, 27));
    expect(d).toEqual({ start_date: '2026-06-30', end_date: '2026-09-27' });
    expect(
      driftSchema.safeParse({ start_date: '2026-09-27', end_date: '2026-09-01' }).success
    ).toBe(false);
  });
});
