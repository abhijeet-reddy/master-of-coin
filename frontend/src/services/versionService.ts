/**
 * Version service (issue #83)
 *
 * Fetches the deployed build's version and commit from the AUTHENTICATED
 * /api/v1/version endpoint. It is behind auth (not on public /health) because
 * the repo is public and the commit sha points at deployed source. Goes through
 * the standard apiClient, which carries the /api/v1 base and the auth token.
 */

import apiClient from '@/lib/axios';

export interface VersionResponse {
  /** Release tag (e.g. "0.21.0") or "dev" for a local build. */
  version: string;
  /** Short git commit (e.g. "a232171") or "unknown" for a local build. */
  commit: string;
}

/** Fetch the deployed build's version. Requires an authenticated session. */
export async function getVersion(): Promise<VersionResponse> {
  const response = await apiClient.get<VersionResponse>('/version');
  return response.data;
}
