import { useQuery } from '@tanstack/react-query';
import { listApiKeys } from '@/api/apiKeys';
import { keys } from '@/api/keys';
import { getVersion } from '@/api/version';
import {
  useAccountList,
  useBankProviders,
  useInvestmentProviders,
} from '@/features/dashboard/hooks/useDashboardQueries';
import { providerLinks } from '@/features/dashboard/lib/dashboardModel';
import { combineQueries } from '@/lib/panelQuery';

export { useSplitProviders } from '@/features/people/hooks/usePeopleQueries';

export const useApiKeys = () => useQuery({ queryKey: keys.apiKeys, queryFn: listApiKeys });

export const useVersion = () =>
  useQuery({ queryKey: keys.version, queryFn: getVersion, staleTime: Infinity });

const NAMES = { bank: 'TrueLayer', investment: 'Trading 212' };

/** Bank (TrueLayer) and brokerage (Trading 212) links, each joined with its account. */
export function useProviderLinks() {
  const query = combineQueries(useBankProviders(), useInvestmentProviders(), useAccountList());
  const links = query.data
    ? providerLinks(query.data[0], query.data[1], query.data[2], NAMES)
    : undefined;
  return { ...query, data: links };
}
