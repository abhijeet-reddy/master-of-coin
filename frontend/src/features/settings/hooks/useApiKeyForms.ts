/** API key create (two steps, then the key shown once), edit and revoke. */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { createApiKey, revokeApiKey, updateApiKey } from '@/api/apiKeys';
import { toApiError } from '@/api/client';
import { keys } from '@/api/keys';
import type { ApiKey, CreateApiKeyResponse } from '@/api/types/apiKey';
import { toast } from '@/ui';
import {
  apiKeySchema,
  createKeyDefaults,
  editKeyDefaults,
  type ApiKeyValues,
} from '../forms/apiKeyForm';
import { createPayload, updatePayload } from '../lib/apiKeyModel';
import { writeErrorMessage } from '../lib/settingsErrors';

export enum CreateStep {
  Details = 1,
  Scopes = 2,
  Created = 3,
}

function useRefreshKeys() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: keys.apiKeys });
}

export function useCreateApiKey() {
  const refresh = useRefreshKeys();
  const [step, setStep] = useState(CreateStep.Details);
  const [created, setCreated] = useState<CreateApiKeyResponse | null>(null);
  const form = useForm<ApiKeyValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: createKeyDefaults(),
  });
  const save = useMutation({
    mutationFn: (v: ApiKeyValues) => createApiKey(createPayload(v.name, v.expiry, v.scopes)),
    onSuccess: refresh,
  });
  const next = async () => {
    if (await form.trigger(['name', 'expiry'])) setStep(CreateStep.Scopes);
  };
  const submit = form.handleSubmit(async (v) => {
    try {
      setCreated(await save.mutateAsync(v));
      setStep(CreateStep.Created);
    } catch (err) {
      form.setError('root', { message: writeErrorMessage(toApiError(err)) });
    }
  });
  /** Back to an empty step one, for the next time the dialog opens. */
  const reset = () => {
    form.reset(createKeyDefaults());
    setCreated(null);
    setStep(CreateStep.Details);
  };
  return {
    form,
    step,
    created,
    next,
    back: () => setStep(CreateStep.Details),
    submit,
    reset,
    saving: save.isPending,
  };
}

export function useEditApiKey(key: ApiKey, onSaved: () => void) {
  const refresh = useRefreshKeys();
  const form = useForm<ApiKeyValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: editKeyDefaults(key),
  });
  const save = useMutation({
    mutationFn: (v: ApiKeyValues) =>
      updateApiKey(key.id, updatePayload(key, v.name, v.expiry, v.scopes)),
    onSuccess: (saved) => {
      refresh();
      toast.success('API key saved', { description: saved.name });
    },
  });
  const submit = form.handleSubmit(async (v) => {
    const patch = updatePayload(key, v.name, v.expiry, v.scopes);
    if (Object.keys(patch).length === 0) return onSaved();
    try {
      await save.mutateAsync(v);
      onSaved();
    } catch (err) {
      form.setError('root', { message: writeErrorMessage(toApiError(err)) });
    }
  });
  return { form, submit, saving: save.isPending };
}

export function useRevokeApiKey() {
  const refresh = useRefreshKeys();
  return useMutation({
    mutationFn: (key: ApiKey) => revokeApiKey(key.id),
    onSuccess: (_v, key) => {
      refresh();
      toast.success('API key revoked', { description: key.name });
    },
    onError: (err) =>
      toast.error("Couldn't revoke the key", { description: toApiError(err).message }),
  });
}
