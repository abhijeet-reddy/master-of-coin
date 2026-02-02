import { useState } from 'react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogBackdrop,
} from '@chakra-ui/react';
import { Button, HStack, VStack, Text, Code, Box } from '@chakra-ui/react';
import { FaCopy, FaCheck } from 'react-icons/fa';

interface ApiKeyCreatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  keyName: string;
}

export const ApiKeyCreatedModal = ({
  isOpen,
  onClose,
  apiKey,
  keyName,
}: ApiKeyCreatedModalProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(apiKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="lg">
      <DialogBackdrop />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API Key Created Successfully</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <VStack align="stretch" gap={4}>
            {/* Warning */}
            <Box p={3} bg="orange.50" borderRadius="md" borderWidth="1px" borderColor="orange.200">
              <Text fontSize="sm" fontWeight="semibold" color="orange.800" mb={1}>
                ⚠️ Save this key now!
              </Text>
              <Text fontSize="sm" color="orange.700">
                You won't be able to see it again. Store it securely.
              </Text>
            </Box>

            {/* API Key Display */}
            <VStack align="stretch" gap={2}>
              <Text fontSize="sm" fontWeight="medium">
                Your API Key for "{keyName}":
              </Text>
              <HStack>
                <Code
                  p={3}
                  borderRadius="md"
                  flex={1}
                  fontSize="sm"
                  wordBreak="break-all"
                  fontFamily="mono"
                >
                  {apiKey}
                </Code>
                <Button size="sm" onClick={handleCopy} colorScheme={copied ? 'green' : 'blue'}>
                  {copied ? <FaCheck /> : <FaCopy />}
                </Button>
              </HStack>
            </VStack>

            {/* Usage Example */}
            <VStack align="stretch" gap={2}>
              <Text fontSize="sm" fontWeight="medium">
                Usage Example:
              </Text>
              <Code p={3} borderRadius="md" fontSize="xs" wordBreak="break-all">
                curl -H "Authorization: Bearer {apiKey}" https://api.example.com/v1/transactions
              </Code>
            </VStack>
          </VStack>
        </DialogBody>

        <DialogFooter>
          <Button colorScheme="blue" onClick={onClose}>
            I've Saved My Key
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
