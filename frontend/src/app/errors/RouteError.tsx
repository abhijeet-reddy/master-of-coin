import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { GlobalError } from './GlobalErrorBoundary';

/** Router-level errorElement: anything the per-route boundary could not catch. */
export function RouteError() {
  const error = useRouteError();
  const shown = isRouteErrorResponse(error)
    ? new Error(`${error.status} ${error.statusText}`)
    : error;
  return <GlobalError error={shown} />;
}
