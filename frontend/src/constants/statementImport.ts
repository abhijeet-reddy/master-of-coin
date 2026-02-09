/** Statement import constants */

/** Maximum file size for CSV uploads (5MB) */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Supported file extensions for statement import */
export const SUPPORTED_EXTENSIONS = ['.csv'] as const;

/** Maximum number of transactions per import */
export const MAX_TRANSACTIONS_PER_IMPORT = 1000;

/** Confidence level thresholds for duplicate detection */
export const CONFIDENCE_LEVELS = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;

export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[keyof typeof CONFIDENCE_LEVELS];
