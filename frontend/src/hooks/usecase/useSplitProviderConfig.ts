import { useState } from 'react';
import { useSplitIntegrations } from '@/hooks/api/useSplitIntegrations';
import {
  usePersonSplitConfig,
  useSetPersonSplitConfig,
  useDeletePersonSplitConfig,
} from '@/hooks/api/usePersonSplitConfig';
import useSplitwiseFriends from '@/hooks/api/useSplitwiseFriends';
import { toaster } from '@/components/ui/toaster';

/**
 * Manages split provider configuration for a person.
 * Handles provider selection, friend selection, saving, and clearing config.
 *
 * @param personId - The person ID to manage config for (empty string if new person)
 * @returns Provider/friend data, selection state, and action handlers
 */
export default function useSplitProviderConfig(personId: string) {
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [selectedFriendId, setSelectedFriendId] = useState('');

  const { data: providers = [] } = useSplitIntegrations();
  const { data: existingConfig, isLoading: isLoadingConfig } = usePersonSplitConfig(personId);
  const { data: friends = [], isLoading: isLoadingFriends } =
    useSplitwiseFriends(selectedProviderId);

  const setConfigMutation = useSetPersonSplitConfig();
  const deleteConfigMutation = useDeletePersonSplitConfig();

  const splitwiseProvider = providers.find((p) => p.provider_type === 'splitwise');
  const hasConfig = !!existingConfig?.id;

  const handleProviderChange = (providerId: string) => {
    setSelectedProviderId(providerId);
    setSelectedFriendId('');
  };

  const handleFriendChange = (friendId: string) => {
    setSelectedFriendId(friendId);
  };

  const handleSave = () => {
    if (!personId || !selectedProviderId || !selectedFriendId) return;

    setConfigMutation.mutate(
      {
        personId,
        config: {
          split_provider_id: selectedProviderId,
          external_user_id: selectedFriendId,
        },
      },
      {
        onSuccess: () => {
          toaster.create({
            title: 'Split Config Saved',
            description: 'Person linked to split provider successfully.',
            type: 'success',
          });
        },
        onError: () => {
          toaster.create({
            title: 'Save Failed',
            description: 'Could not save split configuration. Please try again.',
            type: 'error',
          });
        },
      }
    );
  };

  const handleClear = () => {
    if (!personId) return;

    deleteConfigMutation.mutate(personId, {
      onSuccess: () => {
        setSelectedProviderId('');
        setSelectedFriendId('');
        toaster.create({
          title: 'Split Config Cleared',
          description: 'Person split provider configuration removed.',
          type: 'success',
        });
      },
      onError: () => {
        toaster.create({
          title: 'Clear Failed',
          description: 'Could not clear split configuration. Please try again.',
          type: 'error',
        });
      },
    });
  };

  return {
    // Data
    providers,
    splitwiseProvider,
    friends,
    existingConfig,
    hasConfig,

    // Selection state
    selectedProviderId,
    selectedFriendId,

    // Loading states
    isLoadingConfig,
    isLoadingFriends,
    isSaving: setConfigMutation.isPending,
    isClearing: deleteConfigMutation.isPending,

    // Actions
    handleProviderChange,
    handleFriendChange,
    handleSave,
    handleClear,
  };
}
