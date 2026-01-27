/**
 * Format account type enum to human-readable string
 * @param accountType - Account type enum (e.g., 'CREDIT_CARD', 'SAVINGS')
 * @returns Formatted string (e.g., 'Credit Card', 'Savings')
 */
export const formatAccountType = (accountType: string): string => {
  return accountType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Format budget period enum to human-readable string
 * @param period - Budget period enum (e.g., 'MONTHLY', 'YEARLY')
 * @returns Formatted string (e.g., 'Monthly', 'Yearly')
 */
export const formatBudgetPeriod = (period: string): string => {
  return period.charAt(0).toUpperCase() + period.slice(1).toLowerCase();
};

/**
 * Format any enum-style string to title case
 * @param enumString - Enum string (e.g., 'SOME_VALUE')
 * @returns Formatted string (e.g., 'Some Value')
 */
export const formatEnumString = (enumString: string): string => {
  return enumString
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Get initials from a full name
 * @param name - Full name (e.g., 'John Doe')
 * @returns Initials (e.g., 'JD')
 */
export const getInitials = (name: string): string => {
  if (!name) return 'M';

  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};
