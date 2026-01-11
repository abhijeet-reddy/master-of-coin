import { Box, Card, HStack, VStack, Text, Icon } from '@chakra-ui/react';
import { FiTrendingUp, FiTrendingDown, FiDollarSign } from 'react-icons/fi';

interface NetWorthWidgetProps {
  netWorth: string;
  changePercentage?: number;
}

export const NetWorthWidget = ({ netWorth, changePercentage }: NetWorthWidgetProps) => {
  const isPositive = changePercentage !== undefined && changePercentage >= 0;
  const hasChange = changePercentage !== undefined;

  // Format net worth for display
  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <Card.Root
      bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
      color="white"
      shadow="lg"
      _hover={{ shadow: 'xl', transform: 'translateY(-2px)' }}
      transition="all 0.3s"
    >
      <Card.Body p={6}>
        <VStack alignItems="flex-start" gap={4}>
          {/* Header with icon */}
          <HStack justifyContent="space-between" width="100%">
            <HStack gap={2}>
              <Box
                bg="whiteAlpha.300"
                p={2}
                borderRadius="lg"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Icon fontSize="2xl" color="white">
                  <FiDollarSign />
                </Icon>
              </Box>
              <Text fontSize="lg" fontWeight="medium" opacity={0.9}>
                Net Worth
              </Text>
            </HStack>

            {/* Change indicator */}
            {hasChange && (
              <HStack
                gap={1}
                bg={isPositive ? 'whiteAlpha.300' : 'blackAlpha.300'}
                px={3}
                py={1}
                borderRadius="full"
              >
                <Icon fontSize="sm">{isPositive ? <FiTrendingUp /> : <FiTrendingDown />}</Icon>
                <Text fontSize="sm" fontWeight="semibold">
                  {Math.abs(changePercentage).toFixed(2)}%
                </Text>
              </HStack>
            )}
          </HStack>

          {/* Net worth amount */}
          <Box>
            <Text fontSize={{ base: '3xl', md: '4xl' }} fontWeight="bold" lineHeight="1">
              {formatCurrency(netWorth)}
            </Text>
            {hasChange && (
              <Text fontSize="sm" opacity={0.8} mt={1}>
                {isPositive ? 'Increased' : 'Decreased'} from last year
              </Text>
            )}
          </Box>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
};
