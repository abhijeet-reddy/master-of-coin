import { Link, Navigate } from 'react-router-dom';
import { Button, ButtonVariant, Field, Input } from '@/ui';
import { useAuth } from '@/app/auth/authContext';
import { AuthAlert, AuthLayout } from '../AuthLayout';
import { useLoginForm } from '../useAuthForms';
import styles from '../AuthLayout.module.css';

export function LoginPage() {
  const { isAuthenticated } = useAuth();
  const { form, onSubmit, serverError, returnTo } = useLoginForm();
  const { errors, isSubmitting } = form.formState;

  if (isAuthenticated && !isSubmitting) return <Navigate to={returnTo} replace />;

  return (
    <AuthLayout
      kicker="Sign in"
      subtitle="Sign in to your account"
      footer={
        <>
          No account yet? <Link to="/register">Sign up</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={(e) => void onSubmit(e)} noValidate>
        <AuthAlert title="Login failed" message={serverError} />
        <Field label="Email" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" autoFocus {...form.register('email')} />
        </Field>
        <Field label="Password" required error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...form.register('password')} />
        </Field>
        <Button type="submit" variant={ButtonVariant.Primary} fullWidth loading={isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
