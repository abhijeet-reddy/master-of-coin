import { useState } from 'react';
import { Button, HStack, Input, NativeSelect, VStack } from '@chakra-ui/react';
import { MdLink } from 'react-icons/md';
import { Field } from '@/components/ui/field';
import { InvestmentProviderType } from '@/types';

/** Human-readable labels for provider types */
export const PROVIDER_TYPE_LABELS: Record<InvestmentProviderType, string> = {
  [InvestmentProviderType.TRADING_212]: 'Trading 212',
};

interface ConnectProviderFormProps {
  onSubmit: (
    providerType: InvestmentProviderType,
    apiKey: string,
    apiSecret: string,
    environment?: string
  ) => void;
  isLoading: boolean;
  onCancel: () => void;
}

/**
 * Form for connecting a brokerage provider.
 * Uses onClick handlers (no <form> element) to avoid nested form issues
 * when embedded inside another form (e.g., AccountFormModal).
 * Follows the same pattern as SplitPro/Splitwise integration cards.
 */
export const ConnectProviderForm = ({
  onSubmit,
  isLoading,
  onCancel,
}: ConnectProviderFormProps) => {
  const [formData, setFormData] = useState({
    providerType: InvestmentProviderType.TRADING_212 as InvestmentProviderType,
    apiKey: '',
    apiSecret: '',
    environment: 'live',
  });

  const handleConnect = () => {
    if (!formData.apiKey || !formData.apiSecret) return;
    onSubmit(formData.providerType, formData.apiKey, formData.apiSecret, formData.environment);
  };

  const providerTypes = Object.values(InvestmentProviderType);

  return (
    <VStack gap={4} align="stretch">
      <Field label="Provider">
        <NativeSelect.Root>
          <NativeSelect.Field
            value={formData.providerType}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                providerType: e.target.value as InvestmentProviderType,
              }))
            }
          >
            {providerTypes.map((type) => (
              <option key={type} value={type}>
                {PROVIDER_TYPE_LABELS[type] ?? type}
              </option>
            ))}
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Field>

      <Field label="API Key">
        <Input
          placeholder={`Enter your ${PROVIDER_TYPE_LABELS[formData.providerType]} API Key`}
          value={formData.apiKey}
          onChange={(e) => setFormData((prev) => ({ ...prev, apiKey: e.target.value }))}
        />
      </Field>

      <Field label="API Secret">
        <Input
          type="password"
          placeholder={`Enter your ${PROVIDER_TYPE_LABELS[formData.providerType]} API Secret`}
          value={formData.apiSecret}
          onChange={(e) => setFormData((prev) => ({ ...prev, apiSecret: e.target.value }))}
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

      <HStack gap={2} pt={2}>
        <Button
          colorPalette="blue"
          onClick={handleConnect}
          loading={isLoading}
          disabled={!formData.apiKey || !formData.apiSecret}
        >
          <MdLink />
          Connect
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
      </HStack>
    </VStack>
  );
};
