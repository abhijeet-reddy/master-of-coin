import { ApiErrorKind, type ApiError } from '@/api/client';

/** Profile, password and preference writes need a signed-in session; an API key gets a 403. */
export const SESSION_REQUIRED =
  'This change needs a signed-in session. Requests made with an API key cannot change account settings; sign in with your password and try again.';

/** The message a settings form shows for a failed write. */
export function writeErrorMessage(err: ApiError): string {
  return err.kind === ApiErrorKind.Forbidden ? SESSION_REQUIRED : err.message;
}
