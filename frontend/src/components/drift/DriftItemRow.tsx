import { Badge, Card, DataList, HStack, Text, VStack } from '@chakra-ui/react';
import { formatDate } from '@/utils/formatters/date';
import type { DriftedItem, MissingOnExternal, MissingOnLocal } from '@/types';

interface DriftedItemRowProps {
  item: DriftedItem;
}

interface MissingOnExternalRowProps {
  item: MissingOnExternal;
}

interface MissingOnLocalRowProps {
  item: MissingOnLocal;
}

export const DriftedItemRow = ({ item }: DriftedItemRowProps) => (
  <Card.Root variant="elevated">
    <Card.Body py={3} px={4}>
      <VStack gap={2} alignItems="stretch">
        <HStack justifyContent="space-between">
          <Text fontWeight="medium">{item.transaction_title}</Text>
          <Text fontSize="sm" color="fg.muted">
            {formatDate(item.transaction_date)}
          </Text>
        </HStack>
        <DataList.Root orientation="horizontal" size="sm">
          <DataList.Item>
            <DataList.ItemLabel>Local</DataList.ItemLabel>
            <DataList.ItemValue fontWeight="medium">{item.local_amount}</DataList.ItemValue>
          </DataList.Item>
          <DataList.Item>
            <DataList.ItemLabel>External</DataList.ItemLabel>
            <DataList.ItemValue fontWeight="medium">{item.external_cost}</DataList.ItemValue>
          </DataList.Item>
        </DataList.Root>
        {item.local_splits.length > 0 && (
          <DataList.Root size="sm">
            {item.local_splits.map((split) => (
              <DataList.Item key={split.external_user_id}>
                <DataList.ItemLabel>Local: {split.person_name}</DataList.ItemLabel>
                <DataList.ItemValue>owes {split.owed_share}</DataList.ItemValue>
              </DataList.Item>
            ))}
          </DataList.Root>
        )}
        {item.external_splits.length > 0 && (
          <DataList.Root size="sm">
            {item.external_splits.map((split) => (
              <DataList.Item key={split.external_user_id}>
                <DataList.ItemLabel>
                  Ext: {split.first_name} {split.last_name}
                </DataList.ItemLabel>
                <DataList.ItemValue>owes {split.owed_share}</DataList.ItemValue>
              </DataList.Item>
            ))}
          </DataList.Root>
        )}
      </VStack>
    </Card.Body>
  </Card.Root>
);

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
          <Text fontWeight="medium">
            {item.description} #{item.external_expense_id}
          </Text>
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
