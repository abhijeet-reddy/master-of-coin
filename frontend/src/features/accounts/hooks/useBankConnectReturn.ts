import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { keys } from '@/api/keys';
import { toast } from '@/ui';
import { bankReturnPath, BankReturn, readBankReturn, takeBankConnect } from '../lib/bankConnect';

/**
 * Mounted once in the shell. When TrueLayer's callback lands (on any page),
 * toast the outcome and go back to the account that started it.
 */
export function useBankConnectReturn() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  // The effect can run twice for one landing (StrictMode, a re-render before
  // the redirect lands); the stored account id is one-shot, so handle it once.
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const r = readBankReturn(search);
    if (r.kind === BankReturn.None) {
      handled.current = null;
      return;
    }
    if (handled.current === search) return;
    handled.current = search;
    const accountId = takeBankConnect();
    if (r.kind === BankReturn.Connected) {
      void qc.invalidateQueries({ queryKey: keys.bankProviders });
      toast.success('Bank connected', { description: 'Pick the bank account to link, then sync.' });
    } else {
      toast.error("Couldn't connect the bank", {
        description: r.message ?? 'TrueLayer did not finish the connection.',
      });
    }
    void navigate(bankReturnPath(accountId), { replace: true });
  }, [search, navigate, qc]);
}
