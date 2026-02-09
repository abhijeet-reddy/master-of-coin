/** Custom hook for file upload state management */

import { useState, useCallback } from 'react';
import { validateFile } from '@/utils/fileValidation';

interface UseFileUploadReturn {
  selectedFile: File | null;
  selectedAccountId: string;
  error: string | null;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleAccountChange: (accountId: string) => void;
  canSubmit: boolean;
  clearError: () => void;
}

export const useFileUpload = (): UseFileUploadReturn => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validation = validateFile(file);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid file');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  }, []);

  const handleAccountChange = useCallback((accountId: string) => {
    setSelectedAccountId(accountId);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const canSubmit = Boolean(selectedFile && selectedAccountId && !error);

  return {
    selectedFile,
    selectedAccountId,
    error,
    handleFileChange,
    handleAccountChange,
    canSubmit,
    clearError,
  };
};
