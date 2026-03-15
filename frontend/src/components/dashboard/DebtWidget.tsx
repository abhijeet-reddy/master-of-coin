import { Card, HStack, VStack, Text, Icon, Box } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { FiArrowUpRight, FiArrowDownLeft } from 'react-icons/fi';
import { formatCurrency } from '@/utils/formatters/currency';
import type { DebtOverview } from '@/types';

interface DebtWidgetProps {
  debtOverview: DebtOverview;
}

export const DebtWidget = ({ debtOverview }: DebtWidgetProps) => {
  const navigate = useNavigate();
  const owedToMe = parseFloat(debtOverview.total_owed_to_me) || 0;
  const iOwe = parseFloat(debtOverview.total_i_owe) || 0;

  return (
    <Card.Root
      cursor="pointer"
      onClick={() => void navigate('/people')}
      _hover={{ shadow: 'lg', transform: 'translateY(-2px)' }}
      transition="all 0.3s"
    >
      <Card.Body p={6}>
        <VStack alignItems="stretch" gap={4}>
          <Text fontSize="lg" fontWeight="semibold">
            Debts
          </Text>

          <HStack gap={6} flexWrap="wrap">
            {/* You Are Owed */}
            <VStack align="start" flex="1" minW="120px">
              <HStack gap={2}>
                <Box
                  bg="green.100"
                  p={1.5}
                  borderRadius="md"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon fontSize="md" color="green.600">
                    <FiArrowDownLeft />
                  </Icon>
                </Box>
                <Text fontSize="sm" color="fg.muted">
                  You Are Owed
                </Text>
              </HStack>
              <Text fontSize="xl" fontWeight="bold" color="green.600">
                {formatCurrency(owedToMe)}
              </Text>
            </VStack>

            {/* You Owe */}
            <VStack align="start" flex="1" minW="120px">
              <HStack gap={2}>
                <Box
                  bg="red.100"
                  p={1.5}
                  borderRadius="md"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon fontSize="md" color="red.600">
                    <FiArrowUpRight />
                  </Icon>
                </Box>
                <Text fontSize="sm" color="fg.muted">
                  You Owe
                </Text>
              </HStack>
              <Text fontSize="xl" fontWeight="bold" color="red.600">
                {formatCurrency(iOwe)}
              </Text>
            </VStack>
          </HStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
