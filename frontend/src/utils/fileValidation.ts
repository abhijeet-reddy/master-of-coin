/** File validation utilities */

import { MAX_FILE_SIZE, SUPPORTED_EXTENSIONS } from '@/constants/statementImport';

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate file type and size
 */
export const validateFile = (file: File): FileValidationResult => {
  // Check file extension
  const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
  const isSupportedExtension = SUPPORTED_EXTENSIONS.some((ext) => ext === extension);
  if (!isSupportedExtension) {
    return {
      isValid: false,
      error: `Invalid file type. Only ${SUPPORTED_EXTENSIONS.join(', ')} files are supported.`,
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit.`,
    };
  }

  return { isValid: true };
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
