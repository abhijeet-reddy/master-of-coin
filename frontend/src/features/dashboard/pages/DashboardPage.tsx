import { TransactionEntryActions } from '@/features/transactions';
import { GridCell, PanelGrid } from '@/ui';
import { BalanceSheetPanel } from '../components/BalanceSheetPanel';
import { BudgetsPanel } from '../components/BudgetsPanel';
import { CategoryPanel } from '../components/CategoryPanel';
import { DebtsPanel } from '../components/DebtsPanel';
import { IncomeSpendPanel } from '../components/IncomeSpendPanel';
import { NetWorthPanel } from '../components/NetWorthPanel';
import { ProviderLinksPanel } from '../components/ProviderLinksPanel';
import { RecentActivityPanel } from '../components/RecentActivityPanel';
import { TopSpendPanel } from '../components/TopSpendPanel';
import styles from '../components/Dashboard.module.css';

/** `/dashboard`: every panel loads, fails and retries on its own. */
export function DashboardPage() {
  return (
    <div className={styles.page}>
      <TransactionEntryActions />
      <PanelGrid>
        <GridCell span={8} spanMd={12}>
          <NetWorthPanel />
        </GridCell>
        <GridCell span={4} spanMd={12}>
          <BalanceSheetPanel />
        </GridCell>
        <GridCell span={8} spanMd={12}>
          <IncomeSpendPanel />
        </GridCell>
        <GridCell span={4} spanMd={12}>
          <BudgetsPanel />
        </GridCell>
        <GridCell span={5} spanMd={6}>
          <CategoryPanel />
        </GridCell>
        <GridCell span={3} spanMd={6}>
          <TopSpendPanel />
        </GridCell>
        <GridCell span={4} spanMd={12}>
          <DebtsPanel />
        </GridCell>
        <GridCell span={8} spanMd={12}>
          <RecentActivityPanel />
        </GridCell>
        <GridCell span={4} spanMd={12}>
          <ProviderLinksPanel />
        </GridCell>
      </PanelGrid>
    </div>
  );
}
