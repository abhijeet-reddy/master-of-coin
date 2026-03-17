/** Custom hook for managing import statement modal state and logic */

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ParsedTransaction, BankSyncMetadata } from '@/types';
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
  /** Pre-load transactions and jump directly to preview step (used by bank sync import) */
  loadTransactions: (
    transactions: ParsedTransaction[],
    accountId: string,
    bankSyncMetadata?: BankSyncMetadata
  ) => void;
}

export const useImportStatement = (): UseImportStatementReturn => {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [bankSyncMeta, setBankSyncMeta] = useState<BankSyncMetadata | undefined>(undefined);

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

  const loadTransactions = useCallback(
    (transactions: ParsedTransaction[], accountId: string, metadata?: BankSyncMetadata) => {
      setParsedTransactions(transactions);
      setSelectedAccountId(accountId);
      setBankSyncMeta(metadata);
      setCurrentStep('preview');
    },
    []
  );

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
        // Rebuild bank_sync_metadata to match only the imported transactions.
        // TransactionPreviewStep may filter out deselected transactions, so the
        // metadata must be rebuilt to stay parallel with the transactions array.
        let filteredMeta: BankSyncMetadata | undefined = undefined;
        if (bankSyncMeta && parsedTransactions.length > 0) {
          // Build a lookup: temp_id → external_id (temp_id IS the external_id)
          // Match imported transactions back to parsedTransactions by title+date
          const importedExternalIds: string[] = [];
          for (const txn of transactions) {
            const match = parsedTransactions.find(
              (p) =>
                p.title === txn.title &&
                p.date.startsWith(txn.date.split('T')[0]) &&
                Math.abs(parseFloat(p.amount) - txn.amount) < 0.01
            );
            if (match) {
              importedExternalIds.push(match.temp_id);
            }
          }
          if (importedExternalIds.length === transactions.length) {
            filteredMeta = {
              bank_provider_id: bankSyncMeta.bank_provider_id,
              external_transaction_ids: importedExternalIds,
            };
          }
        }

        const response = await bulkCreateTransactions({
          account_id: selectedAccountId,
          transactions,
          bank_sync_metadata: filteredMeta,
        });

        if (response.success && response.data) {
          setImportSummary({
            created: response.data.created,
            failed: response.data.failed,
          });
          setCurrentStep('confirmation');

          // Invalidate queries to refresh lists
          void queryClient.invalidateQueries({ queryKey: ['transactions'] });
          void queryClient.invalidateQueries({ queryKey: ['accounts'] });
          if (bankSyncMeta) {
            void queryClient.invalidateQueries({ queryKey: ['bank-providers'] });
            void queryClient.invalidateQueries({ queryKey: ['bank-sync-job'] });
          }

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
    [selectedAccountId, bankSyncMeta, parsedTransactions]
  );

  const handleBack = useCallback(() => {
    setCurrentStep('upload');
    setParsedTransactions([]);
    setBankSyncMeta(undefined);
  }, []);

  const resetState = useCallback(() => {
    setCurrentStep('upload');
    setSelectedAccountId('');
    setParsedTransactions([]);
    setImportSummary(null);
    setIsProcessing(false);
    setBankSyncMeta(undefined);
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
    loadTransactions,
  };
};
