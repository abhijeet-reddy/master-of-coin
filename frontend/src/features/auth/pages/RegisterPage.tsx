import { Link, Navigate } from 'react-router-dom';
import { Button, ButtonVariant, Field, Input } from '@/ui';
import { useAuth } from '@/app/auth/authContext';
import { AuthAlert, AuthLayout } from '../AuthLayout';
import { PASSWORD_MIN } from '../schemas';
import { useRegisterForm } from '../useAuthForms';
import styles from '../AuthLayout.module.css';

export function RegisterPage() {
  const { isAuthenticated } = useAuth();
  const { form, onSubmit, serverError } = useRegisterForm();
  const { errors, isSubmitting } = form.formState;

  if (isAuthenticated && !isSubmitting) return <Navigate to="/dashboard" replace />;

  return (
    <AuthLayout
      kicker="New account"
      subtitle="Create your account"
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={(e) => void onSubmit(e)} noValidate>
        <AuthAlert title="Registration failed" message={serverError} />
        <div className={styles.row}>
          <Field label="Username" required error={errors.username?.message}>
            <Input autoComplete="username" autoFocus {...form.register('username')} />
          </Field>
          <Field label="Full name" required error={errors.name?.message}>
            <Input autoComplete="name" {...form.register('name')} />
          </Field>
        </div>
        <Field label="Email" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...form.register('email')} />
        </Field>
        <Field
          label="Password"
          required
          error={errors.password?.message}
          hint={`At least ${PASSWORD_MIN} characters`}
        >
          <Input type="password" autoComplete="new-password" {...form.register('password')} />
        </Field>
        <Field label="Confirm password" required error={errors.confirmPassword?.message}>
          <Input
            type="password"
            autoComplete="new-password"
            {...form.register('confirmPassword')}
          />
        </Field>
        <Button type="submit" variant={ButtonVariant.Primary} fullWidth loading={isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
