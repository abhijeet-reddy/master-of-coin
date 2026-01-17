import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  HStack,
  IconButton,
  Text,
  VStack,
  Collapsible,
  Box,
} from '@chakra-ui/react';
import {
  FaUser,
  FaEnvelope,
  FaPhone,
  FaEdit,
  FaTrash,
  FaChevronDown,
  FaChevronUp,
} from 'react-icons/fa';
import { formatCurrency } from '@/utils/formatters';
import type { Person } from '@/types';

interface PersonCardProps {
  person: Person;
  onEdit: () => void;
  onDelete: () => void;
  onSettle: () => void;
}

export const PersonCard = ({ person, onEdit, onDelete, onSettle }: PersonCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

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
                <Text fontSize="lg" fontWeight="semibold">
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
              <HStack gap={2} fontSize="sm" color="gray.600">
                <FaEnvelope />
                <Text>{person.email}</Text>
              </HStack>
            )}
            {person.phone && (
              <HStack gap={2} fontSize="sm" color="gray.600">
                <FaPhone />
                <Text>{person.phone}</Text>
              </HStack>
            )}
          </VStack>

          {/* Debt Amount Display */}
          <VStack align="start" gap={0}>
            <Text fontSize="sm" color="gray.600">
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

          {/* Transaction History Toggle */}
          {person.transaction_count > 0 && (
            <Box>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-label={`${isExpanded ? 'Hide' : 'Show'} transaction history for ${person.name}`}
                aria-expanded={isExpanded}
              >
                <HStack gap={2}>
                  <Text>
                    {person.transaction_count}{' '}
                    {person.transaction_count === 1 ? 'Transaction' : 'Transactions'}
                  </Text>
                  {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                </HStack>
              </Button>

              <Collapsible.Root open={isExpanded}>
                <Collapsible.Content>
                  <VStack align="start" gap={2} mt={3} pl={4}>
                    <Text fontSize="sm" color="gray.500">
                      View detailed transaction history in the Transactions page
                    </Text>
                  </VStack>
                </Collapsible.Content>
              </Collapsible.Root>
            </Box>
          )}

          {/* Notes preview */}
          {person.notes && (
            <Text fontSize="sm" color="gray.600" lineClamp={2}>
              {person.notes}
            </Text>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
