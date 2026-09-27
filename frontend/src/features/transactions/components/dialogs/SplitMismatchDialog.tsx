import { toApiError } from '@/api/client';
import { Badge, Button, ButtonVariant, Dialog, Money, SignDisplay, Tone } from '@/ui';
import type { MismatchResult } from '../../hooks/useTxMutations';
import { FormAlert } from '../FormAlert';
import styles from './Dialogs.module.css';

interface Props {
  result: MismatchResult | null;
  onClose: () => void;
  onResolve: (action: 'push' | 'pull') => Promise<unknown>;
  resolving: boolean;
  error?: unknown;
}

/** The split provider has an expense for this transaction, but the shares differ. */
export function SplitMismatchDialog({ result, onClose, onResolve, resolving, error }: Props) {
  const open = !!result;
  const r = result;
  const currency = r?.external_expense.currency_code;
  const you = r?.local_splits[0]?.external_user_id ?? null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !resolving && onClose()}
      title="Split mismatch"
      description={
        r?.totals_differ
          ? 'The expense on the split provider has a different total and different shares. Pick which side wins.'
          : 'An expense with the same amount exists on the split provider, but the per-person shares differ. Pick which side wins.'
      }
      footer={
        <>
          <Button onClick={onClose} disabled={resolving}>
            Cancel
          </Button>
          <Button
            onClick={() => void onResolve('pull').then(onClose, () => undefined)}
            disabled={resolving}
          >
            Pull from provider
          </Button>
          <Button
            variant={ButtonVariant.Primary}
            onClick={() => void onResolve('push').then(onClose, () => undefined)}
            loading={resolving}
          >
            Push local
          </Button>
        </>
      }
    >
      {r ? (
        <div className={styles.form}>
          {r.totals_differ ? (
            <FormAlert>
              Totals differ. Local{' '}
              <Money amount={r.local_total} currency={currency} sign={SignDisplay.Never} />,
              provider{' '}
              <Money amount={r.external_total} currency={currency} sign={SignDisplay.Never} />.
              Pulling also updates this transaction&apos;s amount.
            </FormAlert>
          ) : null}
          <div className={styles.compare}>
            <section aria-label="Local shares">
              <p className={styles.kicker}>
                <Badge tone={Tone.Accent}>Local</Badge> Your transaction
              </p>
              <dl className={styles.totals}>
                {r.local_splits.map((s) => (
                  <Row
                    key={s.external_user_id}
                    name={s.person_name}
                    amount={s.owed_share}
                    currency={currency}
                  />
                ))}
              </dl>
            </section>
            <section aria-label="Provider shares">
              <p className={styles.kicker}>
                <Badge tone={Tone.Warn}>External</Badge>{' '}
                {r.external_expense.description || 'Provider expense'}
              </p>
              <dl className={styles.totals}>
                {r.external_expense.users
                  .filter((u) => Number(u.owed_share) > 0)
                  .map((u) => (
                    <Row
                      key={u.external_user_id}
                      name={
                        u.external_user_id === you ? 'You' : `${u.first_name} ${u.last_name}`.trim()
                      }
                      amount={u.owed_share}
                      currency={currency}
                    />
                  ))}
              </dl>
            </section>
          </div>
          {error ? <FormAlert>{toApiError(error).message}</FormAlert> : null}
        </div>
      ) : null}
    </Dialog>
  );
}

function Row({ name, amount, currency }: { name: string; amount: string; currency?: string }) {
  return (
    <>
      <dt>{name}</dt>
      <dd>
        <Money amount={amount} currency={currency} sign={SignDisplay.Never} />
      </dd>
    </>
  );
}
