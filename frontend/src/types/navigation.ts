/**
 * Navigation state types for context-aware breadcrumbs.
 *
 * Passed via React Router `location.state` so detail pages
 * can render breadcrumbs that reflect the user's navigation path.
 */

/** The kind of page the user navigated from. */
export enum NavigationSourceType {
  ACCOUNT = 'ACCOUNT',
  CATEGORY = 'CATEGORY',
  BUDGET = 'BUDGET',
  TRANSACTIONS = 'TRANSACTIONS',
}

/** Describes the page the user navigated from when opening a transaction detail. */
export interface TransactionNavigationState {
  from: {
    type: NavigationSourceType;
    /** ID of the source entity (account, category, or budget). */
    id?: string;
    /** Display name shown in the breadcrumb trail. */
    name?: string;
  };
}
