import { useMemo } from 'react';
import {
  Alert,
  Badge,
  Box,
  Card,
  Checkbox,
  EmptyState,
  HStack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { LuDownload } from 'react-icons/lu';
import { formatDate } from '@/utils/formatters/date';
import type { MissingOnLocal } from '@/types';

interface MissingLocalStepViewProps {
  items: MissingOnLocal[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
}

/**
 * Step 3: Missing on Local items with checkboxes (action is always "pull").
 * Shows external expenses that don't exist in local data.
 * Displays unmapped user warnings using Alert component.
 */
export const MissingLocalStepView = ({
  items,
  selected,
  onToggle,
  onSelectAll,
}: MissingLocalStepViewProps) => {
  const allIds = useMemo(() => items.map((i) => i.external_expense_id), [items]);
  const isAllSelected = items.length > 0 && items.every((i) => selected.has(i.external_expense_id));

  const handleSelectAll = () => {
    if (isAllSelected) return;
    onSelectAll(allIds);
  };

  if (items.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <LuDownload />
          </EmptyState.Indicator>
          <EmptyState.Title>No items missing locally</EmptyState.Title>
          <EmptyState.Description>You can skip this step.</EmptyState.Description>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  return (
    <VStack gap={3} alignItems="stretch">
      <Text fontSize="sm" color="fg.muted">
        Select external expenses to pull into local:
      </Text>

      <Checkbox.Root checked={isAllSelected} onCheckedChange={handleSelectAll}>
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Label>
          <Text fontWeight="medium">Select All ({items.length})</Text>
        </Checkbox.Label>
      </Checkbox.Root>

      {items.map((item) => (
        <Card.Root key={item.external_expense_id}>
          <Card.Body py={3} px={4}>
            <HStack gap={3} alignItems="flex-start">
              <Box pt={1}>
                <Checkbox.Root
                  checked={selected.has(item.external_expense_id)}
                  onCheckedChange={() => onToggle(item.external_expense_id)}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                </Checkbox.Root>
              </Box>

              <VStack gap={1} flex={1} alignItems="stretch">
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
                  <Text fontSize="sm" color="fg.muted">
                    Users:{' '}
                    {item.users
                      .map((u) => `${u.first_name} ${u.last_name} owes ${u.owed_share}`)
                      .join(', ')}
                  </Text>
                )}
                {item.unmapped_users && item.unmapped_users.length > 0 && (
                  <Alert.Root status="warning" size="sm" variant="subtle">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>Unmapped users</Alert.Title>
                      <Alert.Description>
                        {item.unmapped_users.map((user) => (
                          <Badge
                            key={user.external_user_id}
                            colorPalette="yellow"
                            variant="subtle"
                            mr={1}
                            mb={1}
                          >
                            {user.first_name} {user.last_name} (ext: {user.external_user_id})
                          </Badge>
                        ))}
                      </Alert.Description>
                    </Alert.Content>
                  </Alert.Root>
                )}
              </VStack>

              <Badge colorPalette="green" variant="subtle">
                PULL
              </Badge>
            </HStack>
          </Card.Body>
        </Card.Root>
      ))}
    </VStack>
  );
};
