/**
 * Profile, password and preference forms. All three need a signed-in session: an API key
 * gets a 403, shown as a form message rather than a toast.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { changePassword, updateMe } from '@/api/auth';
import { ApiErrorKind, toApiError } from '@/api/client';
import { keys } from '@/api/keys';
import { updatePreferences } from '@/api/preferences';
import { useAuth } from '@/app/auth/authContext';
import { usePreferences } from '@/lib/preferences';
import { toast } from '@/ui';
import {
  PASSWORD_DEFAULTS,
  passwordSchema,
  preferencesSchema,
  profileDefaults,
  profilePatch,
  profileSchema,
  toPreferences,
  type PasswordValues,
  type PreferencesValues,
  type ProfileValues,
} from '../forms/accountForms';
import { writeErrorMessage } from '../lib/settingsErrors';

/** Queries that do not depend on display preferences, so a save leaves them alone. */
const UNAFFECTED = new Set(['preferences', 'auth', 'version', 'api-keys']);

export function useProfileForm() {
  const { user, updateUser } = useAuth();
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: profileDefaults(user),
  });
  const { reset } = form;
  useEffect(() => reset(profileDefaults(user)), [user, reset]);
  const save = useMutation({ mutationFn: updateMe });
  const submit = form.handleSubmit(async (values) => {
    const patch = profilePatch(values, user);
    if (!patch.name && !patch.email) return;
    try {
      updateUser(await save.mutateAsync(patch));
      toast.success('Profile saved');
    } catch (err) {
      const e = toApiError(err);
      if (e.kind === ApiErrorKind.Conflict) {
        form.setError('email', { message: 'Another account already uses this email' });
      } else {
        form.setError('root', { message: writeErrorMessage(e) });
      }
    }
  });
  return { form, submit, saving: save.isPending };
}

export function usePasswordForm() {
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: PASSWORD_DEFAULTS,
  });
  const save = useMutation({ mutationFn: changePassword });
  const submit = form.handleSubmit(async (v) => {
    try {
      await save.mutateAsync({
        current_password: v.current_password,
        new_password: v.new_password,
      });
      form.reset(PASSWORD_DEFAULTS);
      toast.success('Password changed');
    } catch (err) {
      const e = toApiError(err);
      if (e.kind === ApiErrorKind.Validation && /current password/i.test(e.message)) {
        form.setError('current_password', { message: 'That is not your current password' });
      } else {
        form.setError('root', { message: writeErrorMessage(e) });
      }
    }
  });
  return { form, submit, saving: save.isPending };
}

/** Saves to the server, then every page re-renders with the new formatters and totals. */
export function usePreferencesForm() {
  const qc = useQueryClient();
  const { prefs } = usePreferences();
  const form = useForm<PreferencesValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: prefs,
  });
  const { reset } = form;
  useEffect(() => reset(prefs), [prefs, reset]);
  const save = useMutation({
    mutationFn: (v: PreferencesValues) => updatePreferences(toPreferences(v)),
    onSuccess: (saved) => {
      qc.setQueryData(keys.preferences, saved);
      void qc.invalidateQueries({
        predicate: (q) => !UNAFFECTED.has(String(q.queryKey[0])),
      });
      toast.success('Preferences saved');
    },
  });
  const submit = form.handleSubmit(async (v) => {
    try {
      await save.mutateAsync(v);
    } catch (err) {
      form.setError('root', { message: writeErrorMessage(toApiError(err)) });
    }
  });
  return { form, submit, saving: save.isPending };
}
