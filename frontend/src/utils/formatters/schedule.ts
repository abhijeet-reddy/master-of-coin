/**
 * Format schedule parameters into human-readable key-value pairs.
 *
 * Known job-type–specific keys get friendly labels and values;
 * unknown keys fall back to title-cased labels with their raw value.
 */

/** A single formatted parameter ready for display */
export interface FormattedParam {
  label: string;
  value: string;
}

/**
 * Human-readable labels and value formatters for known parameter keys,
 * keyed by job type → parameter name.
 */
const KNOWN_PARAMS: Record<string, Record<string, (v: unknown) => FormattedParam>> = {
  DRIFT_DETECTION: {
    lookback_days: (v) => {
      const days = Number(v);
      return {
        label: 'Lookback Period',
        value: `Last ${days} day${days === 1 ? '' : 's'}`,
      };
    },
  },
};

/**
 * Convert a snake_case key to a Title Case label.
 * e.g. "lookback_days" → "Lookback Days"
 */
const keyToLabel = (key: string): string =>
  key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

/**
 * Format a schedule's parameters into an array of display-ready items.
 *
 * @param jobType  - The schedule's job_type (e.g. "DRIFT_DETECTION")
 * @param params   - The raw parameters object from the API
 * @returns An array of { label, value } pairs, or an empty array if no params
 */
export const formatScheduleParameters = (
  jobType: string,
  params: Record<string, unknown> | undefined
): FormattedParam[] => {
  if (!params) return [];

  const entries = Object.entries(params);
  if (entries.length === 0) return [];

  const jobFormatters = KNOWN_PARAMS[jobType];

  return entries.map(([key, value]) => {
    const formatter = jobFormatters?.[key];
    if (formatter) {
      return formatter(value);
    }
    // Fallback: title-case the key, stringify the value
    return {
      label: keyToLabel(key),
      value: String(value),
    };
  });
};
