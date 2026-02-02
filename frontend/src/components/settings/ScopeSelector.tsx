import { VStack, HStack, Text, Checkbox } from '@chakra-ui/react';
import type { ApiKeyScopes, ScopePermission } from '@/models/apiKey';

interface ScopeSelectorProps {
  value: ApiKeyScopes;
  onChange: (scopes: ApiKeyScopes) => void;
}

const RESOURCES = ['transactions', 'accounts', 'budgets', 'categories', 'people'] as const;

export const ScopeSelector = ({ value, onChange }: ScopeSelectorProps) => {
  const handlePermissionChange = (
    resource: keyof ApiKeyScopes,
    permission: ScopePermission,
    checked: boolean
  ) => {
    const currentPermissions = value[resource] || [];
    const newPermissions = checked
      ? [...currentPermissions, permission]
      : currentPermissions.filter((p) => p !== permission);

    onChange({
      ...value,
      [resource]: newPermissions,
    });
  };

  const hasPermission = (resource: keyof ApiKeyScopes, permission: ScopePermission): boolean => {
    return value[resource]?.includes(permission) || false;
  };

  return (
    <VStack align="stretch" gap={4}>
      <Text fontSize="sm" fontWeight="medium" color="fg">
        Select permissions for this API key
      </Text>

      {RESOURCES.map((resource) => (
        <VStack key={resource} align="stretch" gap={2} p={3} borderWidth="1px" borderRadius="md">
          <Text fontSize="sm" fontWeight="semibold" textTransform="capitalize">
            {resource}
          </Text>
          <HStack gap={4}>
            <Checkbox.Root
              checked={hasPermission(resource, 'read')}
              onCheckedChange={() =>
                handlePermissionChange(resource, 'read', !hasPermission(resource, 'read'))
              }
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label>
                <Text fontSize="sm">Read</Text>
              </Checkbox.Label>
            </Checkbox.Root>
            <Checkbox.Root
              checked={hasPermission(resource, 'write')}
              onCheckedChange={() =>
                handlePermissionChange(resource, 'write', !hasPermission(resource, 'write'))
              }
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label>
                <Text fontSize="sm">Write</Text>
              </Checkbox.Label>
            </Checkbox.Root>
          </HStack>
        </VStack>
      ))}
    </VStack>
  );
};
