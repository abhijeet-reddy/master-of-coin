import { Badge, VStack } from '@chakra-ui/react';
import { DriftedItemRow, MissingOnExternalRow, MissingOnLocalRow } from './DriftItemRow';
import { EmptyState } from '@/components/common';
import type { DriftedItem, MissingOnExternal, MissingOnLocal } from '@/types';

interface DriftedListProps {
  items: DriftedItem[];
}

interface MissingOnExternalListProps {
  items: MissingOnExternal[];
}

interface MissingOnLocalListProps {
  items: MissingOnLocal[];
}

export const DriftedItemList = ({ items }: DriftedListProps) => {
  if (items.length === 0) {
    return <EmptyState title="No drifted items" description="All matched items are in sync." />;
  }

  return (
    <VStack gap={2} alignItems="stretch">
      <Badge variant="outline" alignSelf="flex-start">
        {items.length} item{items.length !== 1 ? 's' : ''}
      </Badge>
      {items.map((item) => (
        <DriftedItemRow key={item.transaction_id} item={item} />
      ))}
    </VStack>
  );
};

export const MissingOnExternalList = ({ items }: MissingOnExternalListProps) => {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No items missing on external"
        description="All local transactions exist on the provider."
      />
    );
  }

  return (
    <VStack gap={2} alignItems="stretch">
      <Badge variant="outline" alignSelf="flex-start">
        {items.length} item{items.length !== 1 ? 's' : ''}
      </Badge>
      {items.map((item) => (
        <MissingOnExternalRow key={item.transaction_id} item={item} />
      ))}
    </VStack>
  );
};

export const MissingOnLocalList = ({ items }: MissingOnLocalListProps) => {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No items missing locally"
        description="All external expenses exist in local data."
      />
    );
  }

  return (
    <VStack gap={2} alignItems="stretch">
      <Badge variant="outline" alignSelf="flex-start">
        {items.length} item{items.length !== 1 ? 's' : ''}
      </Badge>
      {items.map((item) => (
        <MissingOnLocalRow key={item.external_expense_id} item={item} />
      ))}
    </VStack>
  );
};
