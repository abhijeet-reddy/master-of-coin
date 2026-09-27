import { Pencil, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageActions } from '@/app/shell/PageActions';
import { useSetPageMeta } from '@/app/shell/routeMeta';
import { BudgetLedger } from '@/features/transactions';
import { Button, ErrorState, GridCell, Panel, PanelGrid, Skeleton } from '@/ui';
import { BudgetDialogsProvider } from '../components/BudgetDialogsProvider';
import { BudgetSummary } from '../components/BudgetSummary';
import { PacePanel, RangeHistoryPanel } from '../components/DetailPanels';
import { useBudgetDialogs } from '../hooks/budgetDialogs';
import { useBudget, useCategories } from '../hooks/useBudgetQueries';
import { budgetStats } from '../lib/budgetsModel';
import styles from '../components/Budgets.module.css';
import { cx } from '@/ui/cx';

/** `/budgets/:id`: the current period, its pace, every range, and what is counting toward it. */
export function BudgetDetailPage() {
  return (
    <BudgetDialogsProvider>
      <BudgetDetailView />
    </BudgetDialogsProvider>
  );
}

function BudgetDetailView() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const dialogs = useBudgetDialogs();
  const budget = useBudget(id);
  const categories = useCategories();
  const b = budget.data;
  const s = useMemo(() => (b ? budgetStats(b) : null), [b]);
  const catMap = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data]
  );
  useSetPageMeta(b?.name, [{ label: 'Budgets', to: '/budgets' }]);

  if (budget.error)
    return (
      <div className={styles.page}>
        <Panel>
          <ErrorState
            error={budget.error}
            title="Could not load this budget"
            onRetry={() => void budget.refetch()}
          />
        </Panel>
      </div>
    );
  if (!b || !s) return <DetailSkeleton />;

  return (
    <div className={styles.page}>
      <PageActions>
        <Button icon={<Pencil aria-hidden />} onClick={() => dialogs.openEdit(b)}>
          Edit
        </Button>
        <Button
          icon={<Trash2 aria-hidden />}
          onClick={() => dialogs.confirmDelete(b, () => void navigate('/budgets'))}
        >
          Delete
        </Button>
      </PageActions>
      <PanelGrid>
        <GridCell span={4} spanMd={12}>
          <Panel title="This period">
            <BudgetSummary s={s} categories={catMap} showName={false} />
          </Panel>
        </GridCell>
        <GridCell span={8} spanMd={12}>
          <PacePanel s={s} />
        </GridCell>
        <GridCell span={12}>
          <RangeHistoryPanel budget={b} />
        </GridCell>
      </PanelGrid>
      {s.active && s.start && s.end ? (
        <section aria-label="Transactions this period" className={cx(styles.ledger, 'moc-sweep')}>
          <BudgetLedger
            budget={b}
            start={s.start}
            end={s.end}
            categoryId={b.filters?.category_id}
            accountId={b.filters?.account_id}
          />
        </section>
      ) : null}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <span className="sr-only">Loading</span>
      <PanelGrid>
        <GridCell span={4} spanMd={12}>
          <Panel title="This period">
            <Skeleton height={40} width="60%" />
            <Skeleton lines={5} />
          </Panel>
        </GridCell>
        <GridCell span={8} spanMd={12}>
          <Panel title="Pace this period">
            <Skeleton height={220} />
          </Panel>
        </GridCell>
      </PanelGrid>
    </div>
  );
}
