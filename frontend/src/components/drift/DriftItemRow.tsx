import { Badge, Card, DataList, HStack, Text, VStack } from '@chakra-ui/react';
import { formatDate } from '@/utils/formatters/date';
import { buildSplitDiffs, compareTotals } from '@/utils/driftHelpers';
import type { DriftedItem, MissingOnExternal, MissingOnLocal } from '@/types';

/** Color palette and display label for each known provider type */
const PROVIDER_CONFIG: Record<string, { label: string; color: string }> = {
  splitwise: { label: 'Splitwise', color: 'teal' },
  splitpro: { label: 'SplitPro', color: 'purple' },
};

/** Small badge showing which split provider an expense belongs to */
const ProviderBadge = ({ providerType }: { providerType?: string }) => {
  if (!providerType) return null;
  const config = PROVIDER_CONFIG[providerType] ?? { label: providerType, color: 'gray' };
  return (
    <Badge size="sm" variant="subtle" colorPalette={config.color}>
      {config.label}
    </Badge>
  );
};

interface DriftedItemRowProps {
  item: DriftedItem;
}

interface MissingOnExternalRowProps {
  item: MissingOnExternal;
}

interface MissingOnLocalRowProps {
  item: MissingOnLocal;
}

export const DriftedItemRow = ({ item }: DriftedItemRowProps) => {
  const splitDiffs = buildSplitDiffs(item);
  const changedDiffs = splitDiffs.filter((d) => d.isDifferent);
  const totals = compareTotals(item);

  return (
    <Card.Root variant="elevated">
      <Card.Body py={3} px={4}>
        <VStack gap={2} alignItems="stretch">
          <HStack justifyContent="space-between">
            <HStack gap={2}>
              <Text fontWeight="medium">{item.transaction_title}</Text>
              <ProviderBadge providerType={item.provider_type} />
            </HStack>
            <HStack gap={2}>
              <Text fontSize="sm" color="fg.muted">
                {formatDate(item.transaction_date)}
              </Text>
              {totals.isDifferent ? (
                <Text fontWeight="medium">
                  Total:{' '}
                  <Text as="span" textDecoration="line-through" color="fg.muted">
                    {totals.localTotal}
                  </Text>
                  {' → '}
                  {totals.externalTotal}
                </Text>
              ) : (
                <Text fontWeight="medium">Total: {totals.localTotal}</Text>
              )}
            </HStack>
          </HStack>

          {changedDiffs.length > 0 && (
            <>
              <Text fontSize="sm" fontWeight="medium" color="fg.subtle">
                Splits differ:
              </Text>
              <DataList.Root size="sm">
                {changedDiffs.map((d) => (
                  <DataList.Item key={d.name}>
                    <DataList.ItemLabel>{d.name}</DataList.ItemLabel>
                    <DataList.ItemValue>
                      <Text as="span" textDecoration="line-through" color="fg.muted">
                        {d.localOwed ?? '—'}
                      </Text>
                      {' → '}
                      <Text as="span" fontWeight="medium">
                        {d.externalOwed ?? '—'}
                      </Text>
                    </DataList.ItemValue>
                  </DataList.Item>
                ))}
              </DataList.Root>
            </>
          )}

          {changedDiffs.length === 0 && splitDiffs.length > 0 && (
            <>
              <Text fontSize="sm" fontWeight="medium" color="fg.subtle">
                Splits (matching):
              </Text>
              <DataList.Root size="sm">
                {splitDiffs.map((d) => (
                  <DataList.Item key={d.name}>
                    <DataList.ItemLabel>{d.name}</DataList.ItemLabel>
                    <DataList.ItemValue>{d.localOwed ?? d.externalOwed}</DataList.ItemValue>
                  </DataList.Item>
                ))}
              </DataList.Root>
            </>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};

export const MissingOnExternalRow = ({ item }: MissingOnExternalRowProps) => (
  <Card.Root variant="elevated">
    <Card.Body py={3} px={4}>
      <VStack gap={2} alignItems="stretch">
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
          <DataList.Root size="sm">
            {item.splits.map((split) => (
              <DataList.Item key={split.external_user_id}>
                <DataList.ItemLabel>{split.person_name}</DataList.ItemLabel>
                <DataList.ItemValue>owes {split.owed_share}</DataList.ItemValue>
              </DataList.Item>
            ))}
          </DataList.Root>
        )}
      </VStack>
    </Card.Body>
  </Card.Root>
);

export const MissingOnLocalRow = ({ item }: MissingOnLocalRowProps) => (
  <Card.Root variant="elevated">
    <Card.Body py={3} px={4}>
      <VStack gap={2} alignItems="stretch">
        <HStack justifyContent="space-between">
          <HStack gap={2}>
            <Text fontWeight="medium">
              {item.description} #{item.external_expense_id}
            </Text>
            <ProviderBadge providerType={item.provider_type} />
          </HStack>
          <HStack gap={2}>
            <Text fontSize="sm" color="fg.muted">
              {formatDate(item.date)}
            </Text>
            <Text fontWeight="medium">
              {item.cost} {item.currency_code}
            </Text>
          </HStack>
        </HStack>
        {item.users.length > 0 && (
          <DataList.Root size="sm">
            {item.users.map((user) => (
              <DataList.Item key={user.external_user_id}>
                <DataList.ItemLabel>
                  {user.first_name} {user.last_name}
                </DataList.ItemLabel>
                <DataList.ItemValue>owes {user.owed_share}</DataList.ItemValue>
              </DataList.Item>
            ))}
          </DataList.Root>
        )}
        {item.unmapped_users && item.unmapped_users.length > 0 && (
          <HStack gap={2} flexWrap="wrap">
            {item.unmapped_users.map((user) => (
              <Badge key={user.external_user_id} colorPalette="yellow" variant="subtle">
                ⚠ Unmapped: {user.first_name} {user.last_name} (ext: {user.external_user_id})
              </Badge>
            ))}
          </HStack>
        )}
      </VStack>
    </Card.Body>
  </Card.Root>
);
