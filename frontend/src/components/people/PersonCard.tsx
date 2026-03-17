import { Badge, Button, Card, HStack, IconButton, Text, VStack, Box } from '@chakra-ui/react';
import { FaUser, FaEnvelope, FaPhone, FaEdit, FaTrash } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/utils/formatters';
import type { Person } from '@/types';

interface PersonCardProps {
  person: Person;
  onEdit: () => void;
  onDelete: () => void;
  onSettle: () => void;
}

export const PersonCard = ({ person, onEdit, onDelete, onSettle }: PersonCardProps) => {
  const navigate = useNavigate();

  // Calculate debt amount and color
  const debtAmount = person.debt_summary ? parseFloat(person.debt_summary.net) : 0;
  const getDebtColor = () => {
    if (debtAmount > 0) return 'green.600'; // They owe me
    if (debtAmount < 0) return 'red.600'; // I owe them
    return 'gray.600'; // Balanced
  };

  const getDebtText = () => {
    if (debtAmount > 0) return 'Owes Me';
    if (debtAmount < 0) return 'I Owe';
    return 'Settled';
  };

  return (
    <Card.Root>
      <Card.Body>
        <VStack align="stretch" gap={3}>
          {/* Header with icon and actions */}
          <HStack justify="space-between">
            <HStack gap={3}>
              <Text fontSize="2xl" color="blue.500">
                <FaUser />
              </Text>
              <VStack align="start" gap={0}>
                <Text
                  fontSize="lg"
                  fontWeight="semibold"
                  cursor="pointer"
                  _hover={{ textDecoration: 'underline' }}
                  onClick={() => void navigate(`/people/${person.id}`)}
                >
                  {person.name}
                </Text>
                <Badge
                  colorScheme={debtAmount === 0 ? 'gray' : debtAmount > 0 ? 'green' : 'red'}
                  size="sm"
                >
                  {getDebtText()}
                </Badge>
              </VStack>
            </HStack>
            <HStack gap={1}>
              <IconButton aria-label="Edit person" size="sm" variant="ghost" onClick={onEdit}>
                <FaEdit />
              </IconButton>
              <IconButton
                aria-label="Delete person"
                size="sm"
                variant="ghost"
                colorScheme="red"
                onClick={onDelete}
              >
                <FaTrash />
              </IconButton>
            </HStack>
          </HStack>

          {/* Contact Information */}
          <VStack align="start" gap={2}>
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
          </VStack>

          {/* Debt Amount Display */}
          <VStack align="start" gap={0}>
            <Text fontSize="sm" color="fg.muted">
              Balance
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color={getDebtColor()}>
              {formatCurrency(Math.abs(debtAmount))}
            </Text>
          </VStack>

          {/* Settle Up Button */}
          {debtAmount !== 0 && (
            <Button
              colorScheme={debtAmount > 0 ? 'green' : 'red'}
              size="sm"
              onClick={onSettle}
              aria-label={`Settle debt with ${person.name}`}
            >
              Settle Up
            </Button>
          )}

          {/* Transaction History Link */}
          {person.transaction_count > 0 && (
            <Box>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void navigate(`/people/${person.id}`)}
                aria-label={`View transactions for ${person.name}`}
              >
                {person.transaction_count}{' '}
                {person.transaction_count === 1 ? 'Transaction' : 'Transactions'} →
              </Button>
            </Box>
          )}

          {/* Notes preview */}
          {person.notes && (
            <Text fontSize="sm" color="fg.muted" lineClamp={2}>
              {person.notes}
            </Text>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
