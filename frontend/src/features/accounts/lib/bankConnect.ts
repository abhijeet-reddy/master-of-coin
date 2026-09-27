/**
 * TrueLayer round trip. The server's callback always redirects to
 * `/settings?bank_connected=true`, so the account being connected is
 * remembered here and the shell sends the user back to it.
 */
const KEY = 'moc.bankConnect.accountId';

export const BANK_CONNECTED_PARAM = 'bank_connected';
/** Not sent by the server today; honoured so an error redirect lands with a toast once it exists. */
export const BANK_ERROR_PARAM = 'bank_error';

export function rememberBankConnect(accountId: string) {
  try {
    sessionStorage.setItem(KEY, accountId);
  } catch {
    /* storage unavailable: the return lands on /accounts instead */
  }
}

export function takeBankConnect(): string | null {
  try {
    const id = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return id;
  } catch {
    return null;
  }
}

export enum BankReturn {
  None = 'none',
  Connected = 'connected',
  Failed = 'failed',
}

export interface BankReturnResult {
  kind: BankReturn;
  message: string | null;
}

/** Read the callback's outcome from a query string. */
export function readBankReturn(search: string): BankReturnResult {
  const p = new URLSearchParams(search);
  const err = p.get(BANK_ERROR_PARAM);
  if (err !== null) return { kind: BankReturn.Failed, message: err || null };
  if (p.get(BANK_CONNECTED_PARAM) === 'true') return { kind: BankReturn.Connected, message: null };
  return { kind: BankReturn.None, message: null };
}

/** Where to land after the callback. */
export const bankReturnPath = (accountId: string | null) =>
  accountId ? `/accounts/${accountId}` : '/accounts';
