import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { CRON_PRESETS } from '@/types';

interface CronPresetSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export const CronPresetSelector = ({ value, onChange }: CronPresetSelectorProps) => {
  return (
    <VStack gap={2} alignItems="stretch">
      {CRON_PRESETS.map((preset) => (
        <Box
          key={preset.value}
          px={4}
          py={3}
          borderWidth="1px"
          borderRadius="md"
          cursor="pointer"
          bg={value === preset.value ? 'brand.50' : 'transparent'}
          borderColor={value === preset.value ? 'brand.500' : 'border'}
          _hover={{ bg: value === preset.value ? 'brand.50' : 'bg.muted' }}
          onClick={() => onChange(preset.value)}
        >
          <HStack justifyContent="space-between">
            <Text fontSize="sm" fontWeight="medium">
              {preset.label}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              {preset.description}
            </Text>
          </HStack>
        </Box>
      ))}
    </VStack>
  );
};
