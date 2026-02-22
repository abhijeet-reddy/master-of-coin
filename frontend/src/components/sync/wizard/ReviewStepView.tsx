import { useMemo } from 'react';
import {
  Badge,
  Button,
  DataList,
  EmptyState,
  HStack,
  Separator,
  Text,
  VStack,
} from '@chakra-ui/react';
import { LuClipboardList } from 'react-icons/lu';
import { SyncAction } from '@/types';
import type { DriftedSelection, DriftReport, SyncItem } from '@/types';

interface ReviewStepViewProps {
  report: DriftReport;
  selectedDrifted: Map<string, DriftedSelection>;
  selectedMissingExternal: Set<string>;
  selectedMissingLocal: Set<string>;
  buildSyncItems: () => SyncItem[];
  onSubmit: (items: SyncItem[]) => void;
  isSubmitting: boolean;
}

/**
 * Step 4: Review & Submit — summary of all selected actions grouped by push/pull.
 * Uses DataList for structured review display and Separator for visual separation.
 */
export const ReviewStepView = ({
  report,
  selectedDrifted,
  selectedMissingExternal,
  selectedMissingLocal,
  buildSyncItems,
  onSubmit,
  isSubmitting,
}: ReviewStepViewProps) => {
  const syncItems = useMemo(() => buildSyncItems(), [buildSyncItems]);

  const pushItems = useMemo(
    () => syncItems.filter((i) => i.action === SyncAction.PUSH),
    [syncItems]
  );
  const pullItems = useMemo(
    () => syncItems.filter((i) => i.action === SyncAction.PULL),
    [syncItems]
  );

  /** Resolve a human-readable label for a sync item */
  const getItemLabel = (item: SyncItem): string => {
    if (item.transaction_id) {
      const drifted = report.drifted.find((d) => d.transaction_id === item.transaction_id);
      if (drifted) return drifted.transaction_title;
      const missing = report.missing_on_external.find(
        (m) => m.transaction_id === item.transaction_id
      );
      if (missing) return missing.transaction_title;
      return item.transaction_id;
    }
    if (item.external_expense_id) {
      const local = report.missing_on_local.find(
        (m) => m.external_expense_id === item.external_expense_id
      );
      if (local) return `${local.description} #${local.external_expense_id}`;
      return `#${item.external_expense_id}`;
    }
    return 'Unknown item';
  };

  const totalSelected =
    selectedDrifted.size + selectedMissingExternal.size + selectedMissingLocal.size;

  if (totalSelected === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <LuClipboardList />
          </EmptyState.Indicator>
          <EmptyState.Title>No items selected</EmptyState.Title>
          <EmptyState.Description>Go back and select items to sync.</EmptyState.Description>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  return (
    <VStack gap={4} alignItems="stretch">
      <Text fontSize="sm" color="fg.muted">
        Review your sync actions:
      </Text>

      <DataList.Root orientation="horizontal">
        <DataList.Item>
          <DataList.ItemLabel>Total items</DataList.ItemLabel>
          <DataList.ItemValue fontWeight="bold">{syncItems.length}</DataList.ItemValue>
        </DataList.Item>
        <DataList.Item>
          <DataList.ItemLabel>Push</DataList.ItemLabel>
          <DataList.ItemValue>
            <Badge colorPalette="blue">{pushItems.length}</Badge>
          </DataList.ItemValue>
        </DataList.Item>
        <DataList.Item>
          <DataList.ItemLabel>Pull</DataList.ItemLabel>
          <DataList.ItemValue>
            <Badge colorPalette="green">{pullItems.length}</Badge>
          </DataList.ItemValue>
        </DataList.Item>
      </DataList.Root>

      <Separator />

      {pushItems.length > 0 && (
        <VStack gap={2} alignItems="stretch">
          <HStack gap={2}>
            <Badge colorPalette="blue">PUSH</Badge>
            <Text fontWeight="medium">
              {pushItems.length} item{pushItems.length !== 1 ? 's' : ''}
            </Text>
          </HStack>
          <VStack gap={1} alignItems="stretch" pl={4}>
            {pushItems.map((item, idx) => (
              <Text key={idx} fontSize="sm">
                {getItemLabel(item)}
              </Text>
            ))}
          </VStack>
        </VStack>
      )}

      {pullItems.length > 0 && (
        <VStack gap={2} alignItems="stretch">
          <HStack gap={2}>
            <Badge colorPalette="green">PULL</Badge>
            <Text fontWeight="medium">
              {pullItems.length} item{pullItems.length !== 1 ? 's' : ''}
            </Text>
          </HStack>
          <VStack gap={1} alignItems="stretch" pl={4}>
            {pullItems.map((item, idx) => (
              <Text key={idx} fontSize="sm">
                {getItemLabel(item)}
              </Text>
            ))}
          </VStack>
        </VStack>
      )}

      <Separator />

      <Button
        colorPalette="blue"
        onClick={() => onSubmit(syncItems)}
        loading={isSubmitting}
        disabled={syncItems.length === 0}
      >
        Sync All
      </Button>
    </VStack>
  );
};
