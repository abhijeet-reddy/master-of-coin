import { Box, Button, Card, HStack, IconButton, Text, VStack } from '@chakra-ui/react';
import { LuPencil, LuTrash2 } from 'react-icons/lu';
import { FaUser, FaEnvelope, FaPhone } from 'react-icons/fa';
import { formatCurrency } from '@/utils/formatters';
import type { Person } from '@/types';

interface PersonInfoCardProps {
  person: Person;
  onEdit: () => void;
  onDelete: () => void;
  onSettle: () => void;
}

export const PersonInfoCard = ({ person, onEdit, onDelete, onSettle }: PersonInfoCardProps) => {
  const debtAmount = person.debt_summary ? parseFloat(person.debt_summary.net) : 0;

  const getDebtColor = () => {
    if (debtAmount > 0) return 'green.600';
    if (debtAmount < 0) return 'red.600';
    return 'fg.muted';
  };

  const getDebtLabel = () => {
    if (debtAmount > 0) return 'Owes Me';
    if (debtAmount < 0) return 'I Owe';
    return 'Settled';
  };

  return (
    <Card.Root variant="elevated" mb={6}>
      <Card.Body p={6}>
        <VStack align="stretch" gap={4}>
          {/* Header with icon, name, and actions */}
          <HStack justify="space-between" align="flex-start">
            <HStack gap={4}>
              <Box p={3} borderRadius="lg" bg="blue.50" fontSize="2xl" color="blue.500">
                <FaUser />
              </Box>
              <VStack align="start" gap={1}>
                <Text fontSize="xl" fontWeight="bold">
                  {person.name}
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  {person.transaction_count} transaction
                  {person.transaction_count !== 1 ? 's' : ''}
                </Text>
              </VStack>
            </HStack>
            <HStack gap={1}>
              <IconButton aria-label="Edit person" size="sm" variant="ghost" onClick={onEdit}>
                <LuPencil />
              </IconButton>
              <IconButton
                aria-label="Delete person"
                size="sm"
                variant="ghost"
                colorPalette="red"
                onClick={onDelete}
              >
                <LuTrash2 />
              </IconButton>
            </HStack>
          </HStack>

          {/* Contact Information */}
          <HStack gap={6} flexWrap="wrap">
            {person.email && (
              <HStack gap={2} fontSize="sm" color="fg.muted">
                <FaEnvelope />
                <Text>{person.email}</Text>
              </HStack>
            )}
            {person.phone && (
              <HStack gap={2} fontSize="sm" color="fg.muted">
                <FaPhone />
                <Text>{person.phone}</Text>
              </HStack>
            )}
          </HStack>

          {/* Debt Summary */}
          <HStack gap={6} flexWrap="wrap">
            {person.debt_summary && (
              <>
                <VStack align="start" gap={0} minW="120px">
                  <Text fontSize="xs" color="fg.muted">
                    Owes Me
                  </Text>
                  <Text fontSize="lg" fontWeight="semibold" color="green.600">
                    {formatCurrency(parseFloat(person.debt_summary.owes_me))}
                  </Text>
                </VStack>
                <VStack align="start" gap={0} minW="120px">
                  <Text fontSize="xs" color="fg.muted">
                    I Owe
                  </Text>
                  <Text fontSize="lg" fontWeight="semibold" color="red.600">
                    {formatCurrency(parseFloat(person.debt_summary.i_owe))}
                  </Text>
                </VStack>
              </>
            )}
            <VStack align="start" gap={0} minW="120px">
              <Text fontSize="xs" color="fg.muted">
                Net Balance
              </Text>
              <Text fontSize="lg" fontWeight="bold" color={getDebtColor()}>
                {getDebtLabel()}: {formatCurrency(Math.abs(debtAmount))}
              </Text>
            </VStack>
          </HStack>

          {/* Settle Up Button */}
          {debtAmount !== 0 && (
            <Box>
              <Button colorPalette={debtAmount > 0 ? 'green' : 'red'} size="sm" onClick={onSettle}>
                Settle Up
              </Button>
            </Box>
          )}

          {/* Notes */}
          {person.notes && (
            <Text fontSize="sm" color="fg.muted">
              {person.notes}
            </Text>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
