import { useState, useEffect } from 'react';
import type { ApiKey, ApiKeyScopes } from '@/models/apiKey';

interface ApiKeyFormData {
  name: string;
  expiresInDays: number | null;
  scopes: ApiKeyScopes;
}

const DEFAULT_SCOPES: ApiKeyScopes = {
  transactions: [],
  accounts: [],
  budgets: [],
  categories: [],
  people: [],
};

export default function useApiKeyForm(apiKey: ApiKey | null, isOpen: boolean) {
  const [formData, setFormData] = useState<ApiKeyFormData>({
    name: '',
    expiresInDays: null,
    scopes: DEFAULT_SCOPES,
  });

  // Reset form when modal opens or apiKey changes
  useEffect(() => {
    if (isOpen && apiKey) {
      setFormData({
        name: apiKey.name,
        expiresInDays: null,
        scopes: apiKey.scopes,
      });
    } else if (!isOpen) {
      setFormData({
        name: '',
        expiresInDays: null,
        scopes: DEFAULT_SCOPES,
      });
    }
  }, [isOpen, apiKey]);

  const updateField = <K extends keyof ApiKeyFormData>(field: K, value: ApiKeyFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const reset = () => {
    setFormData({
      name: '',
      expiresInDays: null,
      scopes: DEFAULT_SCOPES,
    });
  };

  return {
    formData,
    updateField,
    reset,
  };
}
