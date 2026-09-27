import { useId } from 'react';
import { Button, ButtonVariant, Field, Input, Panel } from '@/ui';
import { useProfileForm } from '../hooks/useAccountForms';
import { Notice } from './Notice';
import styles from './Settings.module.css';

/** Name and email. A taken email is reported on the field. */
export function ProfileTab() {
  const formId = useId();
  const f = useProfileForm();
  const { register, formState } = f.form;
  const errors = formState.errors;
  return (
    <div className={styles.tabBody}>
      <Panel title="Profile">
        <form id={formId} className={styles.form} noValidate onSubmit={(e) => void f.submit(e)}>
          <div className={styles.two}>
            <Field label="Name" required error={errors.name?.message}>
              <Input autoComplete="name" {...register('name')} />
            </Field>
            <Field label="Email" required error={errors.email?.message}>
              <Input type="email" autoComplete="email" {...register('email')} />
            </Field>
          </div>
          {errors.root?.message ? <Notice>{errors.root.message}</Notice> : null}
          <div className={styles.actions}>
            <Button
              type="submit"
              variant={ButtonVariant.Primary}
              loading={f.saving}
              disabled={!formState.isDirty}
            >
              Save profile
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
