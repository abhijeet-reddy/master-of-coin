import { Badge, Status, Table, Text } from '@chakra-ui/react';
import { SyncAction } from '@/types';
import type { SyncItemResult } from '@/types';

interface SyncItemResultRowProps {
  item: SyncItemResult;
}

/**
 * Single sync result row rendered as a Table.Row.
 * Uses Status component for success/failure indicator and Badge for action type.
 */
export const SyncItemResultRow = ({ item }: SyncItemResultRowProps) => {
  const isSuccess = item.status === 'success';
  const identifier = item.transaction_id ?? `#${item.external_expense_id ?? 'unknown'}`;

  return (
    <Table.Row>
      <Table.Cell>
        <Badge colorPalette={item.action === SyncAction.PUSH ? 'blue' : 'green'} variant="subtle">
          {item.action.toUpperCase()}
        </Badge>
      </Table.Cell>
      <Table.Cell>
        <Text fontWeight="medium">{identifier}</Text>
      </Table.Cell>
      <Table.Cell>
        {item.error && (
          <Text fontSize="sm" color="fg.error">
            {item.error}
          </Text>
        )}
        {!item.error && item.detail && (
          <Text fontSize="sm" color="fg.muted">
            {Object.values(item.detail).join(', ')}
          </Text>
        )}
      </Table.Cell>
      <Table.Cell textAlign="end">
        <Status.Root colorPalette={isSuccess ? 'green' : 'red'}>
          <Status.Indicator />
          {isSuccess ? 'OK' : 'ERR'}
        </Status.Root>
      </Table.Cell>
    </Table.Row>
  );
};
