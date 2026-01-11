import { Box, Button, HStack, Input, Text, VStack, Checkbox, Stack } from '@chakra-ui/react';
import { FiFilter, FiX } from 'react-icons/fi';
import type { Account, Category } from '@/types';

export interface TransactionFilterValues {
  accountIds: string[];
  categoryIds: string[];
  startDate?: string;
  endDate?: string;
  minAmount?: string;
  maxAmount?: string;
  transactionType?: 'all' | 'income' | 'expense';
}

interface TransactionFiltersProps {
  accounts: Account[];
  categories: Category[];
  filters: TransactionFilterValues;
  onFilterChange: (filters: TransactionFilterValues) => void;
  onClear: () => void;
}

export const TransactionFilters = ({
  accounts,
  categories,
  filters,
  onFilterChange,
  onClear,
}: TransactionFiltersProps) => {
  const handleAccountToggle = (accountId: string) => {
    const newAccountIds = filters.accountIds.includes(accountId)
      ? filters.accountIds.filter((id) => id !== accountId)
      : [...filters.accountIds, accountId];

    onFilterChange({ ...filters, accountIds: newAccountIds });
  };

  const handleCategoryToggle = (categoryId: string) => {
    const newCategoryIds = filters.categoryIds.includes(categoryId)
      ? filters.categoryIds.filter((id) => id !== categoryId)
      : [...filters.categoryIds, categoryId];

    onFilterChange({ ...filters, categoryIds: newCategoryIds });
  };

  const hasActiveFilters =
    filters.accountIds.length > 0 ||
    filters.categoryIds.length > 0 ||
    filters.startDate ||
    filters.endDate ||
    filters.minAmount ||
    filters.maxAmount ||
    (filters.transactionType && filters.transactionType !== 'all');

  return (
    <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.200" mb={4}>
      <VStack align="stretch" gap={4}>
        {/* Header */}
        <HStack justify="space-between">
          <HStack gap={2}>
            <FiFilter />
            <Text fontWeight="semibold">Filters</Text>
          </HStack>
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" colorScheme="red" onClick={onClear}>
              <HStack gap={1}>
                <FiX />
                <Text>Clear</Text>
              </HStack>
            </Button>
          )}
        </HStack>

        {/* Transaction Type */}
        <Box>
          <Text fontSize="sm" fontWeight="medium" mb={2}>
            Transaction Type
          </Text>
          <HStack gap={2}>
            <Button
              size="sm"
              variant={
                !filters.transactionType || filters.transactionType === 'all' ? 'solid' : 'outline'
              }
              onClick={() => onFilterChange({ ...filters, transactionType: 'all' })}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={filters.transactionType === 'income' ? 'solid' : 'outline'}
              colorScheme="green"
              onClick={() => onFilterChange({ ...filters, transactionType: 'income' })}
            >
              Income
            </Button>
            <Button
              size="sm"
              variant={filters.transactionType === 'expense' ? 'solid' : 'outline'}
              colorScheme="red"
              onClick={() => onFilterChange({ ...filters, transactionType: 'expense' })}
            >
              Expense
            </Button>
          </HStack>
        </Box>

        {/* Date Range */}
        <Box>
          <Text fontSize="sm" fontWeight="medium" mb={2}>
            Date Range
          </Text>
          <HStack gap={2}>
            <Box flex={1}>
              <Input
                type="date"
                size="sm"
                value={filters.startDate || ''}
                onChange={(e) => onFilterChange({ ...filters, startDate: e.target.value })}
                placeholder="Start date"
              />
            </Box>
            <Text fontSize="sm" color="gray.500">
              to
            </Text>
            <Box flex={1}>
              <Input
                type="date"
                size="sm"
                value={filters.endDate || ''}
                onChange={(e) => onFilterChange({ ...filters, endDate: e.target.value })}
                placeholder="End date"
              />
            </Box>
          </HStack>
        </Box>

        {/* Amount Range */}
        <Box>
          <Text fontSize="sm" fontWeight="medium" mb={2}>
            Amount Range
          </Text>
          <HStack gap={2}>
            <Box flex={1}>
              <Input
                type="number"
                size="sm"
                step="0.01"
                value={filters.minAmount || ''}
                onChange={(e) => onFilterChange({ ...filters, minAmount: e.target.value })}
                placeholder="Min amount"
              />
            </Box>
            <Text fontSize="sm" color="gray.500">
              to
            </Text>
            <Box flex={1}>
              <Input
                type="number"
                size="sm"
                step="0.01"
                value={filters.maxAmount || ''}
                onChange={(e) => onFilterChange({ ...filters, maxAmount: e.target.value })}
                placeholder="Max amount"
              />
            </Box>
          </HStack>
        </Box>

        {/* Accounts */}
        {accounts.length > 0 && (
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={2}>
              Accounts
            </Text>
            <Stack gap={2} maxH="150px" overflowY="auto">
              {accounts.map((account) => (
                <Checkbox.Root
                  key={account.id}
                  checked={filters.accountIds.includes(account.id)}
                  onCheckedChange={() => handleAccountToggle(account.id)}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label>
                    <Text fontSize="sm">{account.name}</Text>
                  </Checkbox.Label>
                </Checkbox.Root>
              ))}
            </Stack>
          </Box>
        )}

        {/* Categories */}
        {categories.length > 0 && (
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={2}>
              Categories
            </Text>
            <Stack gap={2} maxH="150px" overflowY="auto">
              {categories.map((category) => (
                <Checkbox.Root
                  key={category.id}
                  checked={filters.categoryIds.includes(category.id)}
                  onCheckedChange={() => handleCategoryToggle(category.id)}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label>
                    <Text fontSize="sm">{category.name}</Text>
                  </Checkbox.Label>
                </Checkbox.Root>
              ))}
            </Stack>
          </Box>
        )}
      </VStack>
    </Box>
  );
};
