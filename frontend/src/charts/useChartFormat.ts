import { useMemo } from 'react';
import { usePreferences } from '@/lib/preferences';

export type NumberFormat = (n: number) => string;

/** Axis (compact) and readout (full) money formatters, unless the caller supplies its own. */
export function useChartFormat(format?: NumberFormat, axisFormat?: NumberFormat) {
  const { fmt } = usePreferences();
  return useMemo(
    () => ({
      value: format ?? ((n: number) => fmt.money(n, undefined, { whole: true })),
      axis: axisFormat ?? format ?? ((n: number) => fmt.money(n, undefined, { compact: true })),
    }),
    [fmt, format, axisFormat]
  );
}
