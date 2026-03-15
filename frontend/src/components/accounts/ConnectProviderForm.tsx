import { useState } from 'react';
import { Button, HStack, Input, NativeSelect, VStack } from '@chakra-ui/react';
import { Field } from '@/components/ui/field';

interface ConnectProviderFormProps {
  onSubmit: (apiKey: string, apiSecret: string, environment?: string) => void;
  isLoading: boolean;
  onCancel: () => void;
}

/**
 * Form for connecting a Trading 212 brokerage provider.
 * Collects API Key, API Secret, and optional environment (live/demo).
 */
export const ConnectProviderForm = ({
  onSubmit,
  isLoading,
  onCancel,
}: ConnectProviderFormProps) => {
  const [formData, setFormData] = useState({ apiKey: '', apiSecret: '', environment: 'live' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.apiKey || !formData.apiSecret) return;
    onSubmit(formData.apiKey, formData.apiSecret, formData.environment);
  };

  return (
    <form onSubmit={handleSubmit}>
      <VStack gap={4} align="stretch">
        <Field label="API Key">
          <Input
            placeholder="Enter your Trading 212 API Key"
            value={formData.apiKey}
            onChange={(e) => setFormData((prev) => ({ ...prev, apiKey: e.target.value }))}
            required
          />
        </Field>

        <Field label="API Secret">
          <Input
            type="password"
            placeholder="Enter your Trading 212 API Secret"
            value={formData.apiSecret}
            onChange={(e) => setFormData((prev) => ({ ...prev, apiSecret: e.target.value }))}
            required
          />
        </Field>

        <Field label="Environment">
          <NativeSelect.Root>
            <NativeSelect.Field
              value={formData.environment}
              onChange={(e) => setFormData((prev) => ({ ...prev, environment: e.target.value }))}
            >
              <option value="live">Live (Real Money)</option>
              <option value="demo">Demo (Paper Trading)</option>
            </NativeSelect.Field>
          </NativeSelect.Root>
        </Field>

        <HStack gap={3} justify="flex-end" pt={2}>
          <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" colorPalette="blue" loading={isLoading}>
            Connect
          </Button>
        </HStack>
      </VStack>
    </form>
  );
};
