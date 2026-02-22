import { useMemo } from 'react';
import {
  Box,
  Card,
  Checkbox,
  EmptyState,
  HStack,
  SegmentGroup,
  Text,
  VStack,
} from '@chakra-ui/react';
import { LuArrowRightLeft } from 'react-icons/lu';
import { formatDate } from '@/utils/formatters/date';
import { SyncAction } from '@/types';
import type { DriftedItem, DriftedSelection } from '@/types';
import { compareTotals, getChangedSplitDiffs } from '@/utils/driftHelpers';
import type { SplitDiff } from '@/utils/driftHelpers';

interface DriftedStepViewProps {
  items: DriftedItem[];
  selected: Map<string, DriftedSelection>;
  onToggle: (id: string, action: SyncAction, externalExpenseId: string) => void;
  onSelectAll: (
    entries: Array<{ id: string; externalExpenseId: string }>,
    action: SyncAction
  ) => void;
}

/**
 * Step 1: Drifted items with checkboxes and push/pull SegmentGroup per item.
 * Each item can be selected with a direction (push local→external, or pull external→local).
 */
export const DriftedStepView = ({
  items,
  selected,
  onToggle,
  onSelectAll,
}: DriftedStepViewProps) => {
  const allEntries = useMemo(
    () =>
      items.map((i) => ({
        id: i.transaction_id,
        externalExpenseId: i.external_expense_id,
      })),
    [items]
  );
  const isAllSelected = items.length > 0 && items.every((i) => selected.has(i.transaction_id));

  const handleSelectAll = () => {
    if (isAllSelected) return;
    onSelectAll(allEntries, SyncAction.PULL);
  };

  if (items.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <LuArrowRightLeft />
          </EmptyState.Indicator>
          <EmptyState.Title>No drifted items found</EmptyState.Title>
          <EmptyState.Description>You can skip this step.</EmptyState.Description>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  return (
    <VStack gap={3} alignItems="stretch">
      <Text fontSize="sm" color="fg.muted">
        Select items and choose Push or Pull for each:
      </Text>

      <Checkbox.Root checked={isAllSelected} onCheckedChange={handleSelectAll}>
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Label>
          <Text fontWeight="medium">Select All ({items.length})</Text>
        </Checkbox.Label>
      </Checkbox.Root>

      {items.map((item) => {
        const isSelected = selected.has(item.transaction_id);
        const currentAction = selected.get(item.transaction_id)?.action ?? SyncAction.PULL;

        return (
          <Card.Root key={item.transaction_id}>
            <Card.Body py={3} px={4}>
              <HStack gap={3} alignItems="flex-start">
                <Box pt={1}>
                  <Checkbox.Root
                    checked={isSelected}
                    onCheckedChange={() =>
                      onToggle(item.transaction_id, currentAction, item.external_expense_id)
                    }
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                  </Checkbox.Root>
                </Box>

                <VStack gap={1} flex={1} alignItems="stretch">
                  <HStack justifyContent="space-between">
                    <Text fontWeight="medium">{item.transaction_title}</Text>
                    <Text fontSize="sm" color="fg.muted">
                      {formatDate(item.transaction_date)}
                    </Text>
                  </HStack>
                  {(() => {
                    const totals = compareTotals(item);
                    const diffs = getChangedSplitDiffs(item);
                    const isPull = currentAction === SyncAction.PULL;
                    // Push: local overwrites external → show external (old) → local (new)
                    // Pull: external overwrites local → show local (old) → external (new)
                    const fromTotal = isPull ? totals.localTotal : totals.externalTotal;
                    const toTotal = isPull ? totals.externalTotal : totals.localTotal;
                    return (
                      <>
                        <HStack gap={4} fontSize="sm">
                          {totals.isDifferent ? (
                            <Text>
                              Total:{' '}
                              <Text as="span" textDecoration="line-through" color="fg.muted">
                                {fromTotal}
                              </Text>
                              {' → '}
                              <Text as="span" fontWeight="medium">
                                {toTotal}
                              </Text>
                            </Text>
                          ) : (
                            <Text fontWeight="medium">Total: {totals.localTotal}</Text>
                          )}
                        </HStack>
                        {diffs.length > 0 && (
                          <VStack gap={0.5} alignItems="stretch" fontSize="xs" color="fg.muted">
                            <Text fontWeight="medium" color="fg.subtle">
                              Splits differ:
                            </Text>
                            {diffs.map((d: SplitDiff) => {
                              const from = isPull ? (d.localOwed ?? '—') : (d.externalOwed ?? '—');
                              const to = isPull ? (d.externalOwed ?? '—') : (d.localOwed ?? '—');
                              return (
                                <Text key={d.name} pl={2}>
                                  {d.name}: {from} → {to}
                                </Text>
                              );
                            })}
                          </VStack>
                        )}
                      </>
                    );
                  })()}
                </VStack>

                {isSelected && (
                  <SegmentGroup.Root
                    size="xs"
                    value={currentAction}
                    onValueChange={(e) =>
                      onToggle(item.transaction_id, e.value as SyncAction, item.external_expense_id)
                    }
                  >
                    <SegmentGroup.Indicator />
                    <SegmentGroup.Items
                      items={[
                        { label: 'Pull', value: SyncAction.PULL },
                        { label: 'Push', value: SyncAction.PUSH },
                      ]}
                    />
                  </SegmentGroup.Root>
                )}
              </HStack>
            </Card.Body>
          </Card.Root>
        );
      })}
    </VStack>
  );
};
