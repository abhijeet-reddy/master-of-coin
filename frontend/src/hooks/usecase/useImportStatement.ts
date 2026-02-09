/** Custom hook for managing import statement modal state and logic */

import { useState, useCallback } from 'react';
import type { ParsedTransaction } from '@/types';
import { parseCSV, bulkCreateTransactions } from '@/services/statementImportService';
import { toaster } from '@/components/ui/toaster';

type Step = 'upload' | 'preview' | 'confirmation';

interface ImportSummary {
  created: number;
  failed: number;
}

interface UseImportStatementReturn {
  currentStep: Step;
  isProcessing: boolean;
  selectedAccountId: string;
  parsedTransactions: ParsedTransaction[];
  importSummary: ImportSummary | null;
  handleFileUpload: (file: File, accountId: string) => Promise<void>;
  handleImport: (
    transactions: Array<{
      account_id: string;
      title: string;
      amount: number;
      date: string;
      notes?: string;
    }>
  ) => Promise<void>;
  handleBack: () => void;
  resetState: () => void;
}

export const useImportStatement = (): UseImportStatementReturn => {
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const handleFileUpload = useCallback(async (file: File, accountId: string) => {
    setIsProcessing(true);
    setSelectedAccountId(accountId);

    try {
      const response = await parseCSV(file, accountId);

      if (response.success && response.data) {
        setParsedTransactions(response.data.transactions);
        setCurrentStep('preview');
        toaster.create({
          title: 'CSV Parsed Successfully',
          description: `Found ${response.data.transactions.length} transactions`,
          type: 'success',
        });
      } else {
        toaster.create({
          title: 'Parse Failed',
          description: response.errors?.join(', ') || 'Failed to parse CSV',
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Failed to parse CSV:', error);
      toaster.create({
        title: 'Parse Error',
        description: error instanceof Error ? error.message : 'Failed to parse CSV file',
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleImport = useCallback(
    async (
      transactions: Array<{
        account_id: string;
        title: string;
        amount: number;
        date: string;
        notes?: string;
      }>
    ) => {
      setIsProcessing(true);

      try {
        const response = await bulkCreateTransactions({
          account_id: selectedAccountId,
          transactions,
        });

        if (response.success && response.data) {
          setImportSummary({
            created: response.data.created,
            failed: response.data.failed,
          });
          setCurrentStep('confirmation');
          toaster.create({
            title: 'Import Complete',
            description: `Successfully imported ${response.data.created} transactions`,
            type: 'success',
          });
        } else {
          toaster.create({
            title: 'Import Failed',
            description: 'Failed to import transactions',
            type: 'error',
          });
        }
      } catch (error) {
        console.error('Failed to import transactions:', error);
        toaster.create({
          title: 'Import Error',
          description: error instanceof Error ? error.message : 'Failed to import transactions',
          type: 'error',
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [selectedAccountId]
  );

  const handleBack = useCallback(() => {
    setCurrentStep('upload');
    setParsedTransactions([]);
  }, []);

  const resetState = useCallback(() => {
    setCurrentStep('upload');
    setSelectedAccountId('');
    setParsedTransactions([]);
    setImportSummary(null);
    setIsProcessing(false);
  }, []);

  return {
    currentStep,
    isProcessing,
    selectedAccountId,
    parsedTransactions,
    importSummary,
    handleFileUpload,
    handleImport,
    handleBack,
    resetState,
  };
};
