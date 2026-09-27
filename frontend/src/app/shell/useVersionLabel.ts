import { useQuery } from '@tanstack/react-query';
import { getVersion } from '@/api/version';
import { keys } from '@/api/keys';

/** "v0.22.0" (with the short commit as a title elsewhere), or null until known. */
export function useVersionLabel(): string | null {
  const { data } = useQuery({
    queryKey: keys.version,
    queryFn: getVersion,
    staleTime: Infinity,
    retry: 1,
  });
  if (!data?.version) return null;
  const v = data.version.replace(/^v/i, '');
  return v === 'dev' ? 'dev build' : `v${v}`;
}
