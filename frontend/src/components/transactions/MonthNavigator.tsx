import { Box, Button, HStack, Text } from '@chakra-ui/react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface MonthNavigatorProps {
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
}

export const MonthNavigator = ({ selectedMonth, onMonthChange }: MonthNavigatorProps) => {
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (11 - i));
    return date;
  });

  const handlePrevMonth = () => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    onMonthChange(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    onMonthChange(newDate);
  };

  const isCurrentMonth = (date: Date) => {
    return (
      date.getMonth() === selectedMonth.getMonth() &&
      date.getFullYear() === selectedMonth.getFullYear()
    );
  };

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <Box mb={4}>
      <HStack gap={2} overflowX="auto" py={2}>
        <Button size="sm" variant="ghost" onClick={handlePrevMonth} aria-label="Previous month">
          <FiChevronLeft />
        </Button>

        {months.map((month, index) => (
          <Button
            key={index}
            size="sm"
            variant={isCurrentMonth(month) ? 'solid' : 'ghost'}
            colorScheme={isCurrentMonth(month) ? 'blue' : 'gray'}
            onClick={() => onMonthChange(month)}
            flexShrink={0}
          >
            <Text fontSize="sm">{formatMonth(month)}</Text>
          </Button>
        ))}

        <Button size="sm" variant="ghost" onClick={handleNextMonth} aria-label="Next month">
          <FiChevronRight />
        </Button>
      </HStack>
    </Box>
  );
};
