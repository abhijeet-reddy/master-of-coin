import { Button, ButtonVariant, Field, Input, Panel } from '@/ui';
import { PASSWORD_MIN } from '../forms/accountForms';
import { usePasswordForm } from '../hooks/useAccountForms';
import { Notice } from './Notice';
import styles from './Settings.module.css';

/** Change password. You stay signed in afterwards. */
export function SecurityTab() {
  const f = usePasswordForm();
  const { register, formState } = f.form;
  const errors = formState.errors;
  return (
    <div className={styles.tabBody}>
      <Panel title="Change password">
        <form className={styles.form} noValidate onSubmit={(e) => void f.submit(e)}>
          <Field label="Current password" required error={errors.current_password?.message}>
            <Input
              type="password"
              autoComplete="current-password"
              {...register('current_password')}
            />
          </Field>
          <div className={styles.two}>
            <Field
              label="New password"
              required
              hint={`At least ${PASSWORD_MIN} characters`}
              error={errors.new_password?.message}
            >
              <Input type="password" autoComplete="new-password" {...register('new_password')} />
            </Field>
            <Field label="Confirm new password" required error={errors.confirm?.message}>
              <Input type="password" autoComplete="new-password" {...register('confirm')} />
            </Field>
          </div>
          {errors.root?.message ? <Notice>{errors.root.message}</Notice> : null}
          <div className={styles.actions}>
            <Button type="submit" variant={ButtonVariant.Primary} loading={f.saving}>
              Change password
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
