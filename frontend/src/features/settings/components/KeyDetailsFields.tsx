import { Controller, type UseFormReturn } from 'react-hook-form';
import { Field, Input, Select } from '@/ui';
import type { ApiKeyValues } from '../forms/apiKeyForm';
import { EXPIRY_LABEL, type ExpiryChoice } from '../lib/apiKeyModel';
import styles from './Settings.module.css';

interface Props {
  form: UseFormReturn<ApiKeyValues>;
  choices: readonly ExpiryChoice[];
  hint?: string;
}

/** Name and expiry, shared by create (step one) and edit. */
export function KeyDetailsFields({ form, choices, hint }: Props) {
  const { register, control, formState } = form;
  const options = choices.map((c) => ({ value: c, label: EXPIRY_LABEL[c] }));
  return (
    <div className={styles.two}>
      <Field label="Name" required error={formState.errors.name?.message}>
        <Input autoComplete="off" placeholder="e.g. Home automation" {...register('name')} />
      </Field>
      <Field label="Expires" required hint={hint}>
        <Controller
          control={control}
          name="expiry"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} options={options} />
          )}
        />
      </Field>
    </div>
  );
}
