import { useMemo } from 'react';
import { z } from 'zod';
import { u, useUrlState } from '@/lib/urlState';
import {
  DEFAULT_PRESET,
  RANGE_PRESETS,
  REPORT_TABS,
  RangePreset,
  ReportTab,
  resolveRange,
  type DateRange,
} from '../lib/reportRange';

const schema = z.object({
  tab: u.enum(REPORT_TABS, ReportTab.Cashflow),
  range: u.enum(RANGE_PRESETS, DEFAULT_PRESET),
  from: u.date(),
  to: u.date(),
});

/** Tab and period live in the URL: `?tab=net-worth&range=custom&from=2026-01-01&to=2026-06-30`. */
export function useReportParams() {
  const [params, setParams] = useUrlState(schema);
  const range = useMemo<DateRange>(
    () => resolveRange(params.range, params.from, params.to, new Date()),
    [params.range, params.from, params.to]
  );
  return {
    tab: params.tab,
    preset: params.range,
    range,
    setTab: (tab: ReportTab) => setParams({ tab }, { history: 'push' }),
    /** A preset drops any custom dates; Custom starts from the range on screen. */
    setPreset: (preset: RangePreset) =>
      setParams(
        preset === RangePreset.Custom
          ? { range: preset, from: range.from, to: range.to }
          : { range: preset, from: undefined, to: undefined },
        { history: 'push' }
      ),
    setDates: (next: Partial<DateRange>) =>
      setParams({ range: RangePreset.Custom, from: range.from, to: range.to, ...next }),
  };
}
