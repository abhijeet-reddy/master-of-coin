/** Account create/edit form: schema, defaults and request builders. */
import { z } from 'zod';
import { AccountType, type Account } from '@/api/types';
import {
  InvestmentProviderType,
  type ConnectInvestmentProviderRequest,
} from '@/api/types/investmentProvider';
import { SELECTABLE_TYPES } from '@/lib/accountTypes';

export const NAME_MAX = 100;
export const NOTES_MAX = 500;

export enum BrokerEnv {
  Live = 'live',
  Demo = 'demo',
}

export const ENV_OPTIONS = [
  { value: BrokerEnv.Live, label: 'Live' },
  { value: BrokerEnv.Demo, label: 'Demo (practice)' },
];

const amount = (v: string) => v.trim() === '' || Number.isFinite(Number(v));

export const accountSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .max(NAME_MAX, `Keep the name under ${NAME_MAX} characters`),
    account_type: z.enum(SELECTABLE_TYPES as [AccountType, ...AccountType[]], {
      error: 'Pick a type',
    }),
    currency: z.string().min(1, 'Pick a currency'),
    /** Create only. Blank means 0. */
    initial_balance: z.string().refine(amount, 'Enter a number, e.g. 250 or -80.50'),
    notes: z.string().max(NOTES_MAX, `Keep notes under ${NOTES_MAX} characters`),
    /** Create only, investment only: connect Trading 212 straight away. */
    connect: z.boolean(),
    api_key: z.string(),
    api_secret: z.string(),
    environment: z.enum([BrokerEnv.Live, BrokerEnv.Demo]),
  })
  .superRefine((v, ctx) => {
    if (!v.connect || v.account_type !== AccountType.INVESTMENT) return;
    if (!v.api_key.trim())
      ctx.addIssue({ code: 'custom', path: ['api_key'], message: 'API key is required' });
    if (!v.api_secret.trim())
      ctx.addIssue({ code: 'custom', path: ['api_secret'], message: 'API secret is required' });
  });

export type AccountFormValues = z.infer<typeof accountSchema>;

export function accountDefaults(
  account: Account | undefined,
  defaultCurrency: string,
  type?: AccountType
): AccountFormValues {
  return {
    name: account?.name ?? '',
    account_type:
      account?.account_type && SELECTABLE_TYPES.includes(account.account_type)
        ? account.account_type
        : (type ?? AccountType.CHECKING),
    currency: account ? String(account.currency) : defaultCurrency,
    initial_balance: '',
    notes: account?.notes ?? '',
    connect: false,
    api_key: '',
    api_secret: '',
    environment: BrokerEnv.Live,
  };
}

export interface CreateAccountBody {
  name: string;
  account_type: string;
  currency: string;
  initial_balance?: number;
  notes?: string;
}

export function buildCreateRequest(v: AccountFormValues): CreateAccountBody {
  const body: CreateAccountBody = {
    name: v.name.trim(),
    account_type: v.account_type,
    currency: v.currency,
  };
  const bal = v.initial_balance.trim();
  if (bal !== '' && Number(bal) !== 0) body.initial_balance = Number(bal);
  if (v.notes.trim()) body.notes = v.notes.trim();
  return body;
}

/** Only what changed. Notes can be cleared by sending an empty string. */
export function buildUpdateRequest(
  v: AccountFormValues,
  before: Account
): Partial<{ name: string; account_type: string; currency: string; notes: string }> {
  const out: Partial<{ name: string; account_type: string; currency: string; notes: string }> = {};
  const name = v.name.trim();
  if (name !== before.name) out.name = name;
  if (v.account_type !== before.account_type) out.account_type = v.account_type;
  if (v.currency !== String(before.currency)) out.currency = v.currency;
  const notes = v.notes.trim();
  if (notes !== (before.notes ?? '').trim()) out.notes = notes;
  return out;
}

/** The brokerage connection to make after creating an investment account, or null. */
export function buildConnectRequest(
  v: AccountFormValues,
  accountId: string
): ConnectInvestmentProviderRequest | null {
  if (!v.connect || v.account_type !== AccountType.INVESTMENT) return null;
  return {
    account_id: accountId,
    provider_type: InvestmentProviderType.TRADING_212,
    api_key: v.api_key.trim(),
    api_secret: v.api_secret.trim(),
    environment: v.environment,
  };
}

/** Standalone Trading 212 connect (from the Connect dialog or the provider panel). */
export const brokerSchema = z.object({
  api_key: z.string().trim().min(1, 'API key is required'),
  api_secret: z.string().trim().min(1, 'API secret is required'),
  environment: z.enum([BrokerEnv.Live, BrokerEnv.Demo]),
});
export type BrokerFormValues = z.infer<typeof brokerSchema>;
