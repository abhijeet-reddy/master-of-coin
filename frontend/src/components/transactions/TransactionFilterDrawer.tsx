import { Badge, Button, CloseButton, Drawer, HStack, Portal, Text } from '@chakra-ui/react';
import { FiFilter, FiX } from 'react-icons/fi';
import { TransactionFilters } from './TransactionFilters';
import type { TransactionFilterValues } from './TransactionFilters';
import type { Account, Category } from '@/types';

interface TransactionFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  filters: TransactionFilterValues;
  onFilterChange: (filters: TransactionFilterValues) => void;
  onClear: () => void;
}

function countActiveFilters(filters: TransactionFilterValues): number {
  let count = 0;
  if (filters.accountIds.length > 0) count++;
  if (filters.categoryIds.length > 0) count++;
  if (filters.startDate || filters.endDate) count++;
  if (filters.minAmount || filters.maxAmount) count++;
  if (filters.transactionType && filters.transactionType !== 'all') count++;
  if (filters.paidByOthers && filters.paidByOthers !== 'all') count++;
  return count;
}

export const TransactionFilterDrawer = ({
  open,
  onClose,
  accounts,
  categories,
  filters,
  onFilterChange,
  onClear,
}: TransactionFilterDrawerProps) => {
  const activeCount = countActiveFilters(filters);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(e) => {
        if (!e.open) onClose();
      }}
      placement={{ mdDown: 'bottom', md: 'end' }}
      size="sm"
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content roundedTop={{ mdDown: 'l3', md: undefined }}>
            <Drawer.Header>
              <HStack justify="space-between" width="100%">
                <HStack gap={2}>
                  <FiFilter />
                  <Drawer.Title>Filters</Drawer.Title>
                  {activeCount > 0 && (
                    <Badge colorPalette="blue" variant="solid" borderRadius="full" size="sm">
                      {activeCount}
                    </Badge>
                  )}
                </HStack>
                {activeCount > 0 && (
                  <Button size="xs" variant="ghost" colorPalette="red" onClick={onClear}>
                    <HStack gap={1}>
                      <FiX />
                      <Text>Clear All</Text>
                    </HStack>
                  </Button>
                )}
              </HStack>
            </Drawer.Header>
            <Drawer.Body>
              <TransactionFilters
                accounts={accounts}
                categories={categories}
                filters={filters}
                onFilterChange={onFilterChange}
              />
            </Drawer.Body>
            <Drawer.Footer>
              <Button variant="outline" width="100%" onClick={onClose}>
                Done
              </Button>
            </Drawer.Footer>
            <Drawer.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
};
