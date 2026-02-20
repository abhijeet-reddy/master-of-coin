import { Badge, Box, Button, HStack, IconButton, Input, Text, VStack } from '@chakra-ui/react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { formatCurrency } from '@/utils/formatters';
import type { ExpenseParticipantInput, CurrencyCode } from '@/types';

interface DebtExpenseParticipantsFormProps {
  participants: ExpenseParticipantInput[];
  onChange: (participants: ExpenseParticipantInput[]) => void;
  currency?: CurrencyCode;
  /** The current user's share (from the Amount field) */
  userShare?: number;
  /** Index of the current user in the participants array (-1 if unknown) */
  userIndex?: number;
}

export const DebtExpenseParticipantsForm = ({
  participants,
  onChange,
  currency,
  userShare,
  userIndex = -1,
}: DebtExpenseParticipantsFormProps) => {
  const handleAddParticipant = () => {
    onChange([...participants, { name: '', paid_share: '0', owed_share: '0' }]);
  };

  const handleRemoveParticipant = (index: number) => {
    onChange(participants.filter((_, i) => i !== index));
  };

  const handleParticipantChange = (
    index: number,
    field: keyof ExpenseParticipantInput,
    value: string
  ) => {
    const updated = [...participants];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  // Calculate totals
  const totalOwed = participants.reduce((sum, p) => sum + (parseFloat(p.owed_share) || 0), 0);

  // User's share: use the prop if provided, otherwise try to find participant without external_user_id
  const userOwedShare =
    userShare !== undefined
      ? userShare
      : (() => {
          const userParticipant = participants.find((p) => !p.external_user_id);
          return userParticipant ? parseFloat(userParticipant.owed_share) || 0 : 0;
        })();

  return (
    <VStack align="stretch" gap={4}>
      <Text fontSize="sm" color="fg.muted">
        Edit each participant&apos;s share of the expense.
      </Text>

      {/* Participant entries */}
      <VStack align="stretch" gap={3}>
        {participants.map((participant, index) => {
          const isPayer = parseFloat(participant.paid_share) > 0;
          const isUser = userIndex >= 0 ? index === userIndex : !participant.external_user_id;

          return (
            <HStack key={index} gap={2} align="center">
              {/* Name */}
              <Box flex={1}>
                <Input
                  value={participant.name}
                  onChange={(e) => handleParticipantChange(index, 'name', e.target.value)}
                  placeholder="Name"
                  size="sm"
                  readOnly={!!participant.external_user_id || isUser}
                />
              </Box>

              {/* Badges */}
              <HStack gap={1} minW="60px" justify="center">
                {isPayer && (
                  <Badge colorScheme="orange" fontSize="xs">
                    Paid
                  </Badge>
                )}
                {isUser && (
                  <Badge colorScheme="blue" fontSize="xs">
                    You
                  </Badge>
                )}
              </HStack>

              {/* Owed share input */}
              <Box w="100px">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={participant.owed_share}
                  onChange={(e) => handleParticipantChange(index, 'owed_share', e.target.value)}
                  placeholder="0.00"
                  size="sm"
                />
              </Box>

              {/* Remove button (only for manually added participants) */}
              {!participant.external_user_id && !isUser ? (
                <IconButton
                  aria-label="Remove participant"
                  variant="ghost"
                  colorScheme="red"
                  size="sm"
                  onClick={() => handleRemoveParticipant(index)}
                >
                  <FiTrash2 />
                </IconButton>
              ) : participant.external_user_id ? (
                <IconButton
                  aria-label="Remove participant"
                  variant="ghost"
                  colorScheme="red"
                  size="sm"
                  onClick={() => handleRemoveParticipant(index)}
                >
                  <FiTrash2 />
                </IconButton>
              ) : (
                <Box w="32px" /> // Spacer for the user row
              )}
            </HStack>
          );
        })}
      </VStack>

      {/* Add participant button */}
      <Button size="sm" variant="outline" onClick={handleAddParticipant}>
        <HStack gap={2}>
          <FiPlus />
          <Text>Add Participant</Text>
        </HStack>
      </Button>

      {/* Summary */}
      <Box p={4} bg="blue.50" borderRadius="md" borderWidth="1px" borderColor="blue.200">
        <VStack align="stretch" gap={2}>
          <HStack justify="space-between">
            <Text fontSize="sm" fontWeight="medium">
              Total Cost (sum of shares):
            </Text>
            <Text fontSize="sm" fontWeight="bold">
              {formatCurrency(totalOwed, currency)}
            </Text>
          </HStack>

          <HStack justify="space-between">
            <Text fontSize="sm" fontWeight="medium" color="blue.600">
              Your Share:
            </Text>
            <Text fontSize="sm" fontWeight="bold" color="blue.600">
              {formatCurrency(userOwedShare, currency)}
            </Text>
          </HStack>
        </VStack>
      </Box>
    </VStack>
  );
};
