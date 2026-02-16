import {
  Box,
  Button,
  HStack,
  VStack,
  Text,
  Separator,
  Badge,
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
  DialogBackdrop,
} from '@chakra-ui/react';
import { FiArrowUp, FiArrowDown } from 'react-icons/fi';
import type { SplitSyncResult } from '@/types';

interface SplitMismatchModalProps {
  result: SplitSyncResult | null;
  onClose: () => void;
  onResolve: (action: 'push' | 'pull') => void;
  isResolving: boolean;
}

/**
 * Modal showing split mismatch details with push/pull resolution options.
 *
 * Displayed when sync finds an expense with matching amount but different splits.
 * Shows local splits vs external splits side-by-side.
 */
export const SplitMismatchModal = ({
  result,
  onClose,
  onResolve,
  isResolving,
}: SplitMismatchModalProps) => {
  if (!result || result.status !== 'mismatch') return null;

  const {
    local_splits = [],
    external_expense,
    totals_differ,
    local_total,
    external_total,
  } = result;

  // The first local split is the payer (You) — use their external_user_id
  // to identify the same user in the external expense and show "You" there too
  const payerExternalId = local_splits.length > 0 ? local_splits[0].external_user_id : null;

  return (
    <DialogRoot open={!!result} onOpenChange={(e) => !e.open && onClose()} size="lg">
      <DialogBackdrop />
      <DialogContent
        css={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <DialogHeader>
          <DialogTitle>Split Mismatch</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>

        <DialogBody>
          <VStack gap={4} align="stretch">
            {/* Total amount mismatch warning */}
            {totals_differ && (
              <Box bg="red.50" border="1px solid" borderColor="red.200" borderRadius="md" p={3}>
                <HStack gap={2} mb={1}>
                  <Badge colorPalette="red" size="sm">
                    ⚠ Total Mismatch
                  </Badge>
                </HStack>
                <Text fontSize="sm" fontWeight="bold" color="red.700">
                  Local total: {local_total} — External total: {external_total}
                </Text>
                <Text fontSize="xs" color="red.600" mt={1}>
                  The total amounts are different. Pulling will update your transaction amount.
                </Text>
              </Box>
            )}

            <Text fontSize="sm" color="fg.muted">
              {totals_differ
                ? 'The expense on the split provider has a different total amount and splits. Choose how to resolve:'
                : 'An expense with the same amount was found on the split provider, but the per-person splits differ. Choose how to resolve:'}
            </Text>

            {/* Local Splits */}
            <Box>
              <HStack gap={2} mb={2}>
                <Badge colorPalette="blue" size="sm">
                  Local
                </Badge>
                <Text fontSize="sm" fontWeight="semibold">
                  Your Transaction Splits
                </Text>
              </HStack>
              <VStack gap={1} align="stretch" pl={2}>
                {local_splits.map((split) => (
                  <HStack
                    key={split.external_user_id}
                    justify="space-between"
                    px={3}
                    py={1}
                    bg="blue.50"
                    borderRadius="md"
                  >
                    <Text fontSize="sm">{split.person_name}</Text>
                    <Text fontSize="sm" fontWeight="bold">
                      {split.owed_share}
                    </Text>
                  </HStack>
                ))}
              </VStack>
            </Box>

            <Separator />

            {/* External Splits */}
            {external_expense && (
              <Box>
                <HStack gap={2} mb={2}>
                  <Badge colorPalette="orange" size="sm">
                    External
                  </Badge>
                  <Text fontSize="sm" fontWeight="semibold">
                    {external_expense.description || 'Split Provider Expense'}
                  </Text>
                </HStack>
                <VStack gap={1} align="stretch" pl={2}>
                  {external_expense.users
                    .filter((u) => parseFloat(u.owed_share) > 0)
                    .map((user) => (
                      <HStack
                        key={user.external_user_id}
                        justify="space-between"
                        px={3}
                        py={1}
                        bg="orange.50"
                        borderRadius="md"
                      >
                        <Text fontSize="sm">
                          {user.external_user_id === payerExternalId
                            ? 'You'
                            : `${user.first_name} ${user.last_name}`}
                        </Text>
                        <Text fontSize="sm" fontWeight="bold">
                          {user.owed_share}
                        </Text>
                      </HStack>
                    ))}
                </VStack>
              </Box>
            )}
          </VStack>
        </DialogBody>

        <DialogFooter>
          <HStack gap={2} width="100%">
            <Button
              flex={1}
              colorScheme="blue"
              onClick={() => onResolve('push')}
              loading={isResolving}
            >
              <HStack gap={1}>
                <FiArrowUp />
                <span>Push Local</span>
              </HStack>
            </Button>
            <Button
              flex={1}
              colorScheme="orange"
              variant="outline"
              onClick={() => onResolve('pull')}
              loading={isResolving}
            >
              <HStack gap={1}>
                <FiArrowDown />
                <span>Pull External</span>
              </HStack>
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
