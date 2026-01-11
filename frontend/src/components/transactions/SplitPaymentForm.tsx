import { Box, Button, HStack, IconButton, Input, Text, VStack } from '@chakra-ui/react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import type { Person, TransactionSplit } from '@/types';
import { formatCurrency } from '@/utils/formatters';

interface SplitPaymentFormProps {
  totalAmount: number;
  splits: TransactionSplit[];
  people: Person[];
  onChange: (splits: TransactionSplit[]) => void;
}

export const SplitPaymentForm = ({
  totalAmount,
  splits,
  people,
  onChange,
}: SplitPaymentFormProps) => {
  const handleAddSplit = () => {
    if (people.length === 0) return;

    const usedPersonIds = new Set(splits.map((s) => s.person_id));
    const availablePerson = people.find((p) => !usedPersonIds.has(p.id));

    if (availablePerson) {
      onChange([
        ...splits,
        {
          person_id: availablePerson.id,
          person_name: availablePerson.name,
          amount: '0',
        },
      ]);
    }
  };

  const handleRemoveSplit = (index: number) => {
    onChange(splits.filter((_, i) => i !== index));
  };

  const handleSplitChange = (index: number, field: 'person_id' | 'amount', value: string) => {
    const newSplits = [...splits];
    if (field === 'person_id') {
      const person = people.find((p) => p.id === value);
      newSplits[index] = {
        ...newSplits[index],
        person_id: value,
        person_name: person?.name,
      };
    } else {
      newSplits[index] = {
        ...newSplits[index],
        amount: value,
      };
    }
    onChange(newSplits);
  };

  // Calculate totals
  const totalSplits = splits.reduce((sum, split) => {
    const amount = parseFloat(split.amount) || 0;
    return sum + amount;
  }, 0);

  const myShare = totalAmount - totalSplits;
  const isValid = totalSplits <= totalAmount && totalSplits >= 0;

  // Get available people for each split
  const getAvailablePeople = (currentPersonId?: string) => {
    const usedIds = new Set(splits.map((s) => s.person_id).filter((id) => id !== currentPersonId));
    return people.filter((p) => !usedIds.has(p.id));
  };

  return (
    <VStack align="stretch" gap={4}>
      <Text fontSize="sm" color="gray.600">
        Split this transaction with others. Enter the amount each person owes.
      </Text>

      {/* Split entries */}
      <VStack align="stretch" gap={3}>
        {splits.map((split, index) => {
          const availablePeople = getAvailablePeople(split.person_id);

          return (
            <HStack key={index} gap={2}>
              {/* Person selector */}
              <Box flex={1}>
                <select
                  value={split.person_id}
                  onChange={(e) => handleSplitChange(index, 'person_id', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <option value="">Select person</option>
                  {availablePeople.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </Box>

              {/* Amount input */}
              <Box flex={1}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={totalAmount}
                  value={split.amount}
                  onChange={(e) => handleSplitChange(index, 'amount', e.target.value)}
                  placeholder="0.00"
                />
              </Box>

              {/* Remove button */}
              <IconButton
                aria-label="Remove split"
                variant="ghost"
                colorScheme="red"
                onClick={() => handleRemoveSplit(index)}
              >
                <FiTrash2 />
              </IconButton>
            </HStack>
          );
        })}
      </VStack>

      {/* Add split button */}
      {splits.length < people.length && (
        <Button size="sm" variant="outline" onClick={handleAddSplit} disabled={people.length === 0}>
          <HStack gap={2}>
            <FiPlus />
            <Text>Add Person</Text>
          </HStack>
        </Button>
      )}

      {/* Summary */}
      <Box
        p={4}
        bg={isValid ? 'blue.50' : 'red.50'}
        borderRadius="md"
        borderWidth="1px"
        borderColor={isValid ? 'blue.200' : 'red.200'}
      >
        <VStack align="stretch" gap={2}>
          <HStack justify="space-between">
            <Text fontSize="sm" fontWeight="medium">
              Total Amount:
            </Text>
            <Text fontSize="sm" fontWeight="bold">
              {formatCurrency(totalAmount)}
            </Text>
          </HStack>

          <HStack justify="space-between">
            <Text fontSize="sm" fontWeight="medium">
              Others' Share:
            </Text>
            <Text fontSize="sm" fontWeight="bold">
              {formatCurrency(totalSplits)}
            </Text>
          </HStack>

          <HStack justify="space-between">
            <Text fontSize="sm" fontWeight="medium" color={myShare < 0 ? 'red.600' : 'inherit'}>
              My Share:
            </Text>
            <Text fontSize="sm" fontWeight="bold" color={myShare < 0 ? 'red.600' : 'green.600'}>
              {formatCurrency(myShare)}
            </Text>
          </HStack>

          {!isValid && (
            <Text fontSize="xs" color="red.600" mt={2}>
              Total splits cannot exceed the transaction amount
            </Text>
          )}
        </VStack>
      </Box>
    </VStack>
  );
};
