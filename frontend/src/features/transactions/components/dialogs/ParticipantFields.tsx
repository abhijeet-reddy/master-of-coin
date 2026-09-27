import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Badge, Field, Input, Money, SignDisplay, Tone } from '@/ui';
import type { TxFormValues } from '../../forms/transactionForm';
import { round2 } from '../../lib/ledger';
import styles from './Dialogs.module.css';

/** Paid-by-others breakdown from the split provider: who paid and who owes what. */
export function ParticipantFields({ currency }: { currency: string }) {
  const { control, register, formState } = useFormContext<TxFormValues>();
  const { fields } = useFieldArray({ control, name: 'participants' });
  const [rows, userIndex] = useWatch({ control, name: ['participants', 'user_index'] });
  const owed = round2(rows.reduce((s, p) => s + (Number(p.owed_share) || 0), 0));
  const paid = round2(rows.reduce((s, p) => s + (Number(p.paid_share) || 0), 0));
  const errs = formState.errors.participants;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <p className={styles.kicker}>[ Expense breakdown ]</p>
      </div>
      <p className={styles.hint}>Edit each participant&apos;s share of the expense.</p>
      {fields.map((f, i) => (
        <div key={f.id} className={styles.partRow}>
          <div className={styles.partName}>
            <span>{rows[i]?.name}</span>
            {i === userIndex ? <Badge>You</Badge> : null}
            {Number(rows[i]?.paid_share) > 0 ? <Badge tone={Tone.Pos}>Paid</Badge> : null}
          </div>
          <Field label="Paid" required error={errs?.[i]?.paid_share?.message}>
            <Input numeric inputMode="decimal" {...register(`participants.${i}.paid_share`)} />
          </Field>
          <Field label="Owes" required error={errs?.[i]?.owed_share?.message}>
            <Input numeric inputMode="decimal" {...register(`participants.${i}.owed_share`)} />
          </Field>
        </div>
      ))}
      <dl className={styles.totals}>
        <dt>Total cost</dt>
        <dd>
          <Money amount={owed} currency={currency} sign={SignDisplay.Never} />
        </dd>
        <dt>Total paid</dt>
        <dd>
          <Money amount={paid} currency={currency} sign={SignDisplay.Never} />
        </dd>
      </dl>
    </div>
  );
}
