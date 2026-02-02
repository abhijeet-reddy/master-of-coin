import type { ApiKey, ApiKeyStatus } from '@/models/apiKey';
import { API_KEY_STATUS_COLORS } from '@/constants';

// Get color scheme based on status
export const getStatusColor = (status: ApiKeyStatus): string => {
  return API_KEY_STATUS_COLORS[status] || 'gray';
};

// Format status for display
export const formatStatus = (status: ApiKeyStatus): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

// Get scopes summary
export const getScopesSummary = (apiKey: ApiKey): string => {
  const resources = Object.keys(apiKey.scopes) as Array<keyof typeof apiKey.scopes>;
  const activeResources = resources.filter((resource) => apiKey.scopes[resource].length > 0);

  if (activeResources.length === 0) return 'No permissions';
  if (activeResources.length === resources.length) return 'All resources';

  return `${activeResources.length} resource${activeResources.length > 1 ? 's' : ''}`;
};
