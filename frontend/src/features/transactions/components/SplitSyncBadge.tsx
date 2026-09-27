import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, RefreshCw, TriangleAlert } from 'lucide-react';
import { keys } from '@/api/keys';
import { retrySync } from '@/api/splitSync';
import { Badge, IconButton, Tone, toast } from '@/ui';
import { useSplitSyncStatus } from '../hooks/useTxQueries';
import styles from './Transactions.module.css';

/** Provider sync state for one split: not synced, synced (links out), syncing, or failed with retry. */
export function SplitSyncBadge({ splitId }: { splitId: string }) {
  const qc = useQueryClient();
  const status = useSplitSyncStatus(splitId);
  const retry = useMutation({
    mutationFn: retrySync,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.splitSyncStatus(splitId) });
      toast.success('Retry queued', { description: 'The sync will run again shortly.' });
    },
    onError: () =>
      toast.error('Retry failed', { description: 'Could not retry the sync. Try again later.' }),
  });
  if (status.isLoading) return <Badge>Checking</Badge>;
  const rec = status.data?.[0];
  if (!rec) return <Badge>Not synced</Badge>;
  if (rec.sync_status === 'synced')
    return rec.external_url ? (
      <a
        className={styles.syncLink}
        href={rec.external_url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Badge tone={Tone.Pos} icon={<Check aria-hidden />}>
          Synced
        </Badge>
      </a>
    ) : (
      <Badge tone={Tone.Pos} icon={<Check aria-hidden />}>
        Synced
      </Badge>
    );
  if (rec.sync_status === 'pending') return <Badge tone={Tone.Warn}>Syncing...</Badge>;
  if (rec.sync_status === 'failed')
    return (
      <span className={styles.syncFail} title={rec.last_error || 'Sync failed'}>
        <Badge tone={Tone.Crit} icon={<TriangleAlert aria-hidden />}>
          Failed
        </Badge>
        <IconButton
          label="Retry sync"
          icon={<RefreshCw />}
          onClick={() => retry.mutate(rec.id)}
          disabled={retry.isPending}
        />
      </span>
    );
  return null;
}
