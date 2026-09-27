import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { safeReturnPath } from '@/api/session';
import { toApiError } from '@/api/client';
import { useAuth } from '@/app/auth/authContext';
import { loginSchema, registerSchema, type LoginValues, type RegisterValues } from './schemas';

/** Where to go after signing in: the `from` query param when it is a safe in-app path. */
export function useReturnPath(): string {
  const [params] = useSearchParams();
  return safeReturnPath(params.get('from'));
}

export function useLoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const returnTo = useReturnPath();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login(values);
      void navigate(returnTo, { replace: true });
    } catch (err) {
      setServerError(toApiError(err).message);
    }
  });

  return { form, onSubmit, serverError, returnTo };
}

export function useRegisterForm() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', email: '', name: '', password: '', confirmPassword: '' },
  });

  const onSubmit = form.handleSubmit(async ({ confirmPassword: _confirm, ...values }) => {
    setServerError(null);
    try {
      await register(values);
      void navigate('/dashboard', { replace: true });
    } catch (err) {
      const apiError = toApiError(err);
      for (const [field, message] of Object.entries(apiError.fieldErrors)) {
        if (field in values) form.setError(field as keyof RegisterValues, { message });
      }
      setServerError(apiError.message);
    }
  });

  return { form, onSubmit, serverError };
}
