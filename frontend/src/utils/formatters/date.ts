/**
 * Format a date string for display
 * @param dateString - ISO date string
 * @param format - Format type ('short' | 'long' | 'full')
 * @returns Formatted date string
 */
export const formatDate = (
  dateString: string,
  format: 'short' | 'long' | 'full' = 'short'
): string => {
  const date = new Date(dateString);

  switch (format) {
    case 'short':
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    case 'long':
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    case 'full':
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    default:
      return date.toLocaleDateString('en-US');
  }
};

/**
 * Format date with year for API keys
 * @param dateString - ISO date string or undefined
 * @returns Formatted date string or 'Never'
 */
export const formatDateWithYear = (dateString?: string): string => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format date and time
 * @param dateString - ISO date string or undefined
 * @returns Formatted date and time string or 'Never'
 */
export const formatDateTime = (dateString?: string): string => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Format time only (HH:MM)
 * @param dateString - ISO date string or undefined
 * @returns Formatted time string in 24-hour format or 'Never'
 */
export const formatTime = (dateString?: string): string => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

/**
 * Format a date string as relative time (e.g., "2 min ago", "1 hr ago")
 * @param dateString - ISO date string
 * @returns Relative time string
 */
export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(dateString, 'short');
};

/**
 * Format a scheduled next-run date for display.
 *
 * - Future dates: relative time like "in 2 hours", "in 3 days", or absolute for >7 days
 * - Past dates: returns { label: "Overdue (...)", overdue: true }
 * - Null: "Not scheduled"
 */
export interface ScheduleNextRunDisplay {
  label: string;
  overdue: boolean;
}

export const formatScheduleNextRun = (dateString: string | null): ScheduleNextRunDisplay => {
  if (!dateString) {
    return { label: 'Not scheduled', overdue: false };
  }

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  // Past date — overdue
  if (diffMs < 0) {
    return {
      label: `Overdue (${formatDateTime(dateString)})`,
      overdue: true,
    };
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return { label: 'in less than a minute', overdue: false };
  if (diffMin < 60) return { label: `in ${diffMin} min`, overdue: false };
  if (diffHr < 24) return { label: `in ${diffHr} hr`, overdue: false };
  if (diffDay < 7) return { label: `in ${diffDay}d`, overdue: false };

  return { label: formatDateTime(dateString), overdue: false };
};
