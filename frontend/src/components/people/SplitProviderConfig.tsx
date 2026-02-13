import { Box, VStack, HStack, Text, Button, Badge, Separator, Skeleton } from '@chakra-ui/react';
import { MdLink, MdDelete } from 'react-icons/md';
import { Field } from '@/components/ui/field';
import { useSplitProviderConfig } from '@/hooks/usecase';

interface SplitProviderConfigProps {
  personId: string;
}

/**
 * Split provider configuration section for a person form.
 * Allows selecting a provider and linking to an external friend/user.
 * All business logic is delegated to useSplitProviderConfig hook.
 */
export const SplitProviderConfig = ({ personId }: SplitProviderConfigProps) => {
  const {
    splitwiseProvider,
    friends,
    existingConfig,
    hasConfig,
    selectedProviderId,
    selectedFriendId,
    isLoadingConfig,
    isLoadingFriends,
    isSaving,
    isClearing,
    handleProviderChange,
    handleFriendChange,
    handleSave,
    handleClear,
  } = useSplitProviderConfig(personId);

  if (isLoadingConfig) {
    return (
      <VStack align="stretch" gap={2}>
        <Separator />
        <Skeleton height="16px" width="120px" />
        <Skeleton height="40px" borderRadius="md" />
      </VStack>
    );
  }

  return (
    <VStack align="stretch" gap={3}>
      <Separator />

      <Text fontWeight="semibold" fontSize="sm">
        Split Provider
      </Text>

      {/* Show existing config */}
      {hasConfig && existingConfig && (
        <Box p={3} borderWidth="1px" borderRadius="md">
          <HStack justify="space-between">
            <VStack align="start" gap={1}>
              <HStack gap={2}>
                <Badge colorPalette="green" size="sm">
                  {existingConfig.provider_type}
                </Badge>
                <Text fontSize="sm">
                  Linked to external user #{existingConfig.external_user_id}
                </Text>
              </HStack>
            </VStack>
            <Button
              variant="ghost"
              colorPalette="red"
              size="sm"
              onClick={handleClear}
              loading={isClearing}
              aria-label="Clear split config"
            >
              <Box as={MdDelete} />
            </Button>
          </HStack>
        </Box>
      )}

      {/* Provider selection */}
      {!hasConfig && (
        <VStack align="stretch" gap={3}>
          <Field label="Provider">
            <select
              value={selectedProviderId}
              onChange={(e) => handleProviderChange(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                width: '100%',
              }}
            >
              <option value="">None</option>
              {splitwiseProvider && <option value={splitwiseProvider.id}>Splitwise</option>}
            </select>
          </Field>

          {/* Friend selection (Splitwise) */}
          {selectedProviderId && (
            <Field label="Splitwise Friend">
              {isLoadingFriends ? (
                <VStack align="stretch" gap={2}>
                  <Skeleton height="40px" borderRadius="md" />
                </VStack>
              ) : (
                <select
                  value={selectedFriendId}
                  onChange={(e) => handleFriendChange(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    width: '100%',
                  }}
                >
                  <option value="">Select a friend...</option>
                  {friends.map((friend) => (
                    <option key={friend.id} value={String(friend.id)}>
                      {friend.full_name} ({friend.email})
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}

          {/* Save button */}
          {selectedProviderId && selectedFriendId && (
            <Button colorPalette="blue" size="sm" onClick={handleSave} loading={isSaving}>
              <Box as={MdLink} mr={2} />
              Link to Provider
            </Button>
          )}
        </VStack>
      )}
    </VStack>
  );
};
