import { Badge, Status, Table, Text } from '@chakra-ui/react';
import { SyncAction } from '@/types';
import type { SyncItemResult } from '@/types';

interface SyncItemResultRowProps {
  item: SyncItemResult;
}

/** Statuses that indicate no actual sync occurred — shown as skipped. */
const SKIPPED_STATUSES = new Set(['not_applicable', 'already_linked']);

/**
 * Derive a human-readable detail message from the raw `detail` record
 * returned by the backend sync operations.
 */
function formatDetail(detail: Record<string, unknown>): string {
  const syncStatus = detail.sync_status as string | undefined;
  const status = detail.status as string | undefined;
  const message = detail.message as string | undefined;
  const externalId = detail.external_expense_id as string | undefined;

  const key = syncStatus ?? status;

  switch (key) {
    case 'created': {
      const suffix = externalId ? ` (ID: ${externalId})` : '';
      return `Created on provider${suffix}`;
    }
    case 'synced':
      return 'Already in sync';
    case 'linked':
      return 'Auto-linked to existing expense';
    case 'imported':
      return 'Imported as local transaction';
    case 'not_applicable':
      return message ?? 'Skipped — no sync needed';
    case 'already_linked':
      return message ?? 'Already linked — no action taken';
    case 'pushed':
      return message ?? 'Pushed to provider';
    case 'pulled':
      return message ?? 'Updated from provider';
    default:
      // Unknown status — fall back to the message field or raw values
      return message ?? Object.values(detail).join(', ');
  }
}

/**
 * Single sync result row rendered as a Table.Row.
 * Uses Status component for success/failure indicator and Badge for action type.
 */
export const SyncItemResultRow = ({ item }: SyncItemResultRowProps) => {
  const isSuccess = item.status === 'success';
  const identifier = item.transaction_id ?? `#${item.external_expense_id ?? 'unknown'}`;

  // Determine the sync status from the detail payload for status-column colouring
  const detailStatus =
    (item.detail?.sync_status as string | undefined) ?? (item.detail?.status as string | undefined);
  const isSkipped = isSuccess && detailStatus != null && SKIPPED_STATUSES.has(detailStatus);

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
            {formatDetail(item.detail)}
          </Text>
        )}
      </Table.Cell>
      <Table.Cell textAlign="end">
        {isSkipped ? (
          <Status.Root colorPalette="gray">
            <Status.Indicator />
            SKIP
          </Status.Root>
        ) : (
          <Status.Root colorPalette={isSuccess ? 'green' : 'red'}>
            <Status.Indicator />
            {isSuccess ? 'OK' : 'ERR'}
          </Status.Root>
        )}
      </Table.Cell>
    </Table.Row>
  );
};
