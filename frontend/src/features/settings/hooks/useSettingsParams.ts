import { useEffect } from 'react';
import { z } from 'zod';
import { u, useUrlState } from '@/lib/urlState';
import { toast } from '@/ui';
import { normalizeTab, OAuthStatus, SETTINGS_TABS, SettingsTab } from '../lib/settingsTabs';

const schema = z.object({
  tab: z.preprocess(normalizeTab, u.enum(SETTINGS_TABS, SettingsTab.Profile)),
  status: u.optionalString(),
});

/** `?tab=` picks the tab; `?status=` is what the Splitwise OAuth callback reports once. */
export function useSettingsParams() {
  const [params, setParams] = useUrlState(schema);
  const { status } = params;

  useEffect(() => {
    if (status === OAuthStatus.Connected) {
      toast.success('Splitwise connected', {
        description: 'Split expenses will sync from now on.',
      });
    } else if (status === OAuthStatus.Error) {
      toast.error('Splitwise connection failed', { description: 'Try connecting again.' });
    }
    if (status)
      setParams({ tab: SettingsTab.Integrations, status: undefined }, { history: 'replace' });
  }, [status, setParams]);

  return {
    tab: params.tab as SettingsTab,
    setTab: (tab: SettingsTab) => setParams({ tab }, { history: 'push' }),
  };
}
