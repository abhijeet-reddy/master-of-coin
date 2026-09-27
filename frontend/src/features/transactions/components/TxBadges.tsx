import { ArrowLeftRight, NotebookText, Split, UserRound } from 'lucide-react';
import { Badge, Money, SignDisplay, Tone } from '@/ui';
import type { LedgerRow } from '../lib/ledger';

/** Row facts as words, never colour alone: split, paid by, transfer, note, foreign currency. */
export function TxBadges({ row, base }: { row: LedgerRow; base: string }) {
  return (
    <>
      {row.split ? (
        <Badge icon={<Split aria-hidden />}>
          Split <b>{row.split.count > 1 ? `${row.split.count} people` : row.split.name}</b>{' '}
          <Money amount={row.split.othersTotal} currency={row.currency} sign={SignDisplay.Never} />
        </Badge>
      ) : null}
      {row.paidBy ? (
        <Badge tone={Tone.Warn} icon={<UserRound aria-hidden />}>
          Paid by {row.paidBy}
        </Badge>
      ) : null}
      {row.transfer ? (
        <Badge icon={<ArrowLeftRight aria-hidden />}>
          Transfer {row.transfer.direction} <b>{row.transfer.account}</b>
        </Badge>
      ) : null}
      {row.hasNote ? <Badge icon={<NotebookText aria-hidden />}>Note</Badge> : null}
      {row.currency !== base ? <Badge>{row.currency}</Badge> : null}
    </>
  );
}
