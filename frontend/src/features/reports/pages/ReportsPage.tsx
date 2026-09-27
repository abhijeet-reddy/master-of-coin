import { TabPanel, Tabs } from '@/ui';
import { BudgetsTab } from '../components/BudgetsTab';
import { CashflowTab } from '../components/CashflowTab';
import { CategoriesTab } from '../components/CategoriesTab';
import { NetWorthTab } from '../components/NetWorthTab';
import { RangeBar } from '../components/RangeBar';
import { useReportParams } from '../hooks/useReportParams';
import { RANGED_TABS, REPORT_TAB_LABEL, REPORT_TABS, ReportTab } from '../lib/reportRange';
import styles from '../components/Reports.module.css';

const ITEMS = REPORT_TABS.map((t) => ({ value: t, label: REPORT_TAB_LABEL[t] }));

/** `/reports`: server aggregates by tab; the ranged tabs follow the period in the URL. */
export function ReportsPage() {
  const report = useReportParams();
  const { tab, range } = report;
  return (
    <div className={styles.page}>
      <Tabs value={tab} onValueChange={report.setTab} items={ITEMS} label="Reports">
        {RANGED_TABS.has(tab) ? <RangeBar report={report} /> : null}
        <TabPanel value={ReportTab.Cashflow}>
          {tab === ReportTab.Cashflow ? <CashflowTab range={range} /> : null}
        </TabPanel>
        <TabPanel value={ReportTab.Categories}>
          {tab === ReportTab.Categories ? <CategoriesTab /> : null}
        </TabPanel>
        <TabPanel value={ReportTab.Budgets}>
          {tab === ReportTab.Budgets ? <BudgetsTab /> : null}
        </TabPanel>
        <TabPanel value={ReportTab.NetWorth}>
          {tab === ReportTab.NetWorth ? <NetWorthTab range={range} /> : null}
        </TabPanel>
      </Tabs>
    </div>
  );
}
