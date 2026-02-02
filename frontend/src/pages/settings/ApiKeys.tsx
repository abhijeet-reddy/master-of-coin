import { useState } from 'react';
import { Box, Button } from '@chakra-ui/react';
import { PageHeader, ErrorAlert } from '@/components/common';
import {
  ApiKeyList,
  CreateApiKeyModal,
  EditApiKeyModal,
  RevokeApiKeyDialog,
} from '@/components/settings';
import { useDocumentTitle } from '@/hooks';
import { useApiKeys } from '@/hooks/api/apiKeys';
import type { ApiKey } from '@/models/apiKey';

export const ApiKeys = () => {
  useDocumentTitle('API Keys');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editApiKey, setEditApiKey] = useState<ApiKey | null>(null);
  const [revokeApiKey, setRevokeApiKey] = useState<ApiKey | null>(null);

  const { data: apiKeys = [], isLoading, error } = useApiKeys();

  // Query error state
  if (error) {
    return (
      <Box>
        <PageHeader title="API Keys" />
        <ErrorAlert title="Failed to load API keys" error={error} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="API Keys"
        subtitle="Manage API keys for programmatic access"
        actions={
          <Button colorScheme="blue" onClick={() => setIsCreateModalOpen(true)}>
            New API Key
          </Button>
        }
      />

      {/* API Key List */}
      <ApiKeyList
        apiKeys={apiKeys}
        isLoading={isLoading}
        onEdit={(apiKey) => setEditApiKey(apiKey)}
        onRevoke={(apiKey) => setRevokeApiKey(apiKey)}
      />

      {/* Create API Key Modal */}
      <CreateApiKeyModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />

      {/* Edit API Key Modal */}
      <EditApiKeyModal
        isOpen={!!editApiKey}
        onClose={() => setEditApiKey(null)}
        apiKey={editApiKey}
      />

      {/* Revoke API Key Dialog */}
      <RevokeApiKeyDialog
        isOpen={!!revokeApiKey}
        onClose={() => setRevokeApiKey(null)}
        apiKey={revokeApiKey}
      />
    </Box>
  );
};
