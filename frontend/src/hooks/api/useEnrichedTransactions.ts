import { useMemo } from 'react';
import useAccounts from './useAccounts';
import useCategories from './useCategories';
import type { Transaction, EnrichedTransaction } from '@/types';

/**
 * Enriches raw transaction data with account and category details
 * Uses cached data from useAccounts and useCategories hooks
 *
 * @param rawTransactions - Raw transactions from API (with only IDs)
 * @returns Enriched transactions with full account and category objects
 */
export default function useEnrichedTransactions(
  rawTransactions?: Transaction[]
): EnrichedTransaction[] {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();

  return useMemo(() => {
    if (!rawTransactions || !accounts || !categories) {
      return [];
    }

    // Create lookup maps for efficient access
    const accountMap = new Map(accounts.map((account) => [account.id, account]));
    const categoryMap = new Map(categories.map((category) => [category.id, category]));

    // Enrich transactions with account and category details
    return rawTransactions.map((transaction): EnrichedTransaction => {
      const account = accountMap.get(transaction.account_id)!;
      const category = transaction.category_id
        ? categoryMap.get(transaction.category_id)
        : undefined;

      return {
        id: transaction.id,
        title: transaction.title,
        amount: transaction.amount,
        date: transaction.date,
        account: {
          id: account.id,
          name: account.name,
          type: account.account_type,
          currency: account.currency,
        },
        category: category
          ? {
              id: category.id,
              name: category.name,
              icon: category.icon,
            }
          : undefined,
        notes: transaction.notes,
        splits: transaction.splits,
        user_share: transaction.user_share,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at,
      };
    });
  }, [rawTransactions, accounts, categories]);
}
