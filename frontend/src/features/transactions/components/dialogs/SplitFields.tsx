import { Plus, Trash2 } from 'lucide-react';
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';
import {
  Button,
  ButtonVariant,
  Combobox,
  ControlSize,
  Field,
  IconButton,
  Input,
  Money,
  SignDisplay,
} from '@/ui';
import type { TxFormValues } from '../../forms/transactionForm';
import { usePeople } from '../../hooks/useTxQueries';
import { equalSplits, round2 } from '../../lib/ledger';
import { personOptions } from '../../lib/options';
import { FormAlert } from '../FormAlert';
import styles from './Dialogs.module.css';

/** "I paid, others owe me": one row per person with the amount they owe. */
export function SplitFields({ currency }: { currency: string }) {
  const { control, register, setValue, formState } = useFormContext<TxFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'splits' });
  const people = usePeople();
  const [amount, splits] = useWatch({ control, name: ['amount', 'splits'] });
  const total = Number(amount) || 0;
  const others = round2(splits.reduce((s, x) => s + (Number(x.amount) || 0), 0));
  const mine = round2(total - others);
  const errs = formState.errors.splits;
  const arrayError = errs?.message ?? errs?.root?.message;
  const options = personOptions(people.data);

  const splitEqually = () => {
    equalSplits(total, fields.length).forEach((v, i) =>
      setValue(`splits.${i}.amount`, v, {
        shouldDirty: true,
        shouldValidate: formState.isSubmitted,
      })
    );
  };

  return (
    <div className={styles.section}>
      <p className={styles.hint}>
        Split this transaction with others. Enter the amount each person owes.
      </p>
      {people.data && people.data.length === 0 ? (
        <p className={styles.hint}>
          No people yet. <Link to="/people">Add someone on the People page</Link> first.
        </p>
      ) : null}
      {fields.map((f, i) => (
        <div key={f.id} className={styles.splitRow}>
          <Field label={`Person ${i + 1}`} required error={errs?.[i]?.person_id?.message}>
            <Controller
              control={control}
              name={`splits.${i}.person_id`}
              render={({ field }) => (
                <Combobox
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                  options={options}
                  placeholder="Pick a person"
                  searchPlaceholder="Search people"
                />
              )}
            />
          </Field>
          <Field label="Owes" required error={errs?.[i]?.amount?.message}>
            <Input numeric inputMode="decimal" {...register(`splits.${i}.amount`)} />
          </Field>
          <div className={styles.rowAction}>
            <IconButton
              label={`Remove person ${i + 1}`}
              icon={<Trash2 />}
              onClick={() => remove(i)}
            />
          </div>
        </div>
      ))}
      <div className={styles.sectionHead}>
        <Button
          size={ControlSize.Sm}
          icon={<Plus />}
          onClick={() => append({ person_id: '', amount: '' })}
          disabled={people.data?.length === 0}
        >
          Add person
        </Button>
        {fields.length > 0 ? (
          <Button
            size={ControlSize.Sm}
            variant={ButtonVariant.Ghost}
            onClick={splitEqually}
            disabled={!(total > 0)}
          >
            Split equally
          </Button>
        ) : null}
      </div>
      {fields.length > 0 ? (
        <dl className={styles.totals}>
          <dt>Total</dt>
          <dd>
            <Money amount={total} currency={currency} sign={SignDisplay.Never} />
          </dd>
          <dt>Others&apos; share</dt>
          <dd>
            <Money amount={others} currency={currency} sign={SignDisplay.Never} />
          </dd>
          <dt>My share</dt>
          <dd>
            <Money amount={mine} currency={currency} />
          </dd>
        </dl>
      ) : null}
      {arrayError ? <FormAlert>{arrayError}</FormAlert> : null}
    </div>
  );
}
