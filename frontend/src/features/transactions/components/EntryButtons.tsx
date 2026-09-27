import { ArrowLeftRight, Download, Plus } from 'lucide-react';
import { Button, ButtonVariant } from '@/ui';
import { useTxDialogs } from '../hooks/txDialogs';

/**
 * Import, Transfer and Add transaction, in that order (primary last).
 * `transferOnly` is for investment accounts, whose balance moves by transfers and syncs.
 */
export function EntryButtons({
  accountId,
  transferOnly = false,
}: {
  accountId?: string;
  transferOnly?: boolean;
}) {
  const d = useTxDialogs();
  return (
    <>
      {transferOnly ? null : (
        <Button icon={<Download aria-hidden />} onClick={() => d.openImport(accountId)}>
          Import
        </Button>
      )}
      <Button icon={<ArrowLeftRight aria-hidden />} onClick={() => d.openTransfer(accountId)}>
        Transfer
      </Button>
      {transferOnly ? null : (
        <Button
          variant={ButtonVariant.Primary}
          icon={<Plus aria-hidden />}
          onClick={() => d.openCreate(accountId)}
        >
          Add transaction
        </Button>
      )}
    </>
  );
}
