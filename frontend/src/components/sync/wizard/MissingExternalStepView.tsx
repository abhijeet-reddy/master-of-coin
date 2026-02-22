import { useMemo } from 'react';
import { Badge, Box, Card, Checkbox, EmptyState, HStack, Text, VStack } from '@chakra-ui/react';
import { LuUpload } from 'react-icons/lu';
import { formatDate } from '@/utils/formatters/date';
import type { MissingOnExternal } from '@/types';

interface MissingExternalStepViewProps {
  items: MissingOnExternal[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
}

/**
 * Step 2: Missing on External items with checkboxes (action is always "push").
 * Shows local transactions that don't exist on the external provider.
 */
export const MissingExternalStepView = ({
  items,
  selected,
  onToggle,
  onSelectAll,
}: MissingExternalStepViewProps) => {
  const allIds = useMemo(() => items.map((i) => i.transaction_id), [items]);
  const isAllSelected = items.length > 0 && items.every((i) => selected.has(i.transaction_id));

  const handleSelectAll = () => {
    if (isAllSelected) return;
    onSelectAll(allIds);
  };

  if (items.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <LuUpload />
          </EmptyState.Indicator>
          <EmptyState.Title>No items missing on external</EmptyState.Title>
          <EmptyState.Description>You can skip this step.</EmptyState.Description>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  return (
    <VStack gap={3} alignItems="stretch">
      <Text fontSize="sm" color="fg.muted">
        Select local transactions to push to provider:
      </Text>

      <Checkbox.Root checked={isAllSelected} onCheckedChange={handleSelectAll}>
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Label>
          <Text fontWeight="medium">Select All ({items.length})</Text>
        </Checkbox.Label>
      </Checkbox.Root>

      {items.map((item) => (
        <Card.Root key={item.transaction_id}>
          <Card.Body py={3} px={4}>
            <HStack gap={3} alignItems="flex-start">
              <Box pt={1}>
                <Checkbox.Root
                  checked={selected.has(item.transaction_id)}
                  onCheckedChange={() => onToggle(item.transaction_id)}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                </Checkbox.Root>
              </Box>

              <VStack gap={1} flex={1} alignItems="stretch">
                <HStack justifyContent="space-between">
                  <Text fontWeight="medium">{item.transaction_title}</Text>
                  <HStack gap={2}>
                    <Text fontSize="sm" color="fg.muted">
                      {formatDate(item.transaction_date)}
                    </Text>
                    <Text fontWeight="medium">{item.amount}</Text>
                  </HStack>
                </HStack>
                {item.splits.length > 0 && (
                  <Text fontSize="sm" color="fg.muted">
                    Splits:{' '}
                    {item.splits.map((s) => `${s.person_name} owes ${s.owed_share}`).join(', ')}
                  </Text>
                )}
              </VStack>

              <Badge colorPalette="blue" variant="subtle">
                PUSH
              </Badge>
            </HStack>
          </Card.Body>
        </Card.Root>
      ))}
    </VStack>
  );
};
