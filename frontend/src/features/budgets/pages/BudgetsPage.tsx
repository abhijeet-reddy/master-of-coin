import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import type { Budget, Category } from '@/api/types';
import { PageActions } from '@/app/shell/PageActions';
import { combineQueries } from '@/lib/panelQuery';
import { usePreferences } from '@/lib/preferences';
import { u, useUrlState } from '@/lib/urlState';
import {
  Button,
  buttonClass,
  ButtonVariant,
  ControlSize,
  EmptyState,
  GridCell,
  IconButton,
  Panel,
  PanelGrid,
  PanelState,
  Skeleton,
} from '@/ui';
import { BudgetCard } from '../components/BudgetCard';
import { BudgetDialogsProvider } from '../components/BudgetDialogsProvider';
import { BudgetSummary } from '../components/BudgetSummary';
import { CountingList, RangeHistory } from '../components/DetailPanels';
import { OverallPanel } from '../components/OverallPanel';
import { PaceMonitor } from '../components/PaceMonitor';
import { PeriodFilter } from '../components/PeriodFilter';
import { useBudgetDialogs } from '../hooks/budgetDialogs';
import { useBudgets, useCategories } from '../hooks/useBudgetQueries';
import {
  budgetStats,
  filterByPeriod,
  overall,
  PERIODS,
  PERIOD_LABEL,
  periodCounts,
  sortBudgets,
  type BudgetStats,
} from '../lib/budgetsModel';
import styles from '../components/Budgets.module.css';

const listSchema = z.object({
  period: u.enum(['ALL', ...PERIODS] as const, 'ALL'),
  open: u.optionalString(),
});

/** `/budgets`: overall gauge, pace monitor, the cards, and the selected budget beside them. */
export function BudgetsPage() {
  return (
    <BudgetDialogsProvider>
      <BudgetsView />
    </BudgetDialogsProvider>
  );
}

function CreateButton() {
  const dialogs = useBudgetDialogs();
  return (
    <Button
      variant={ButtonVariant.Primary}
      icon={<Plus aria-hidden />}
      onClick={() => dialogs.openCreate()}
    >
      Create budget
    </Button>
  );
}

function BudgetsView() {
  const budgets = useBudgets();
  const categories = useCategories();
  const query = combineQueries(budgets, categories);
  return (
    <div className={styles.page}>
      <PageActions>
        <CreateButton />
      </PageActions>
      <PanelState
        query={query}
        skeleton={<ListSkeleton />}
        empty={([list]) =>
          list.length === 0 ? (
            <Panel>
              <EmptyState
                title="No budgets yet"
                description="Set a limit for a category, or for all spending, over a day, week, month, quarter or year."
                action={<CreateButton />}
              />
            </Panel>
          ) : null
        }
      >
        {([list, cats]) => <BudgetsBody list={list} categories={cats} />}
      </PanelState>
    </div>
  );
}

function BudgetsBody({ list, categories }: { list: Budget[]; categories: Category[] }) {
  const { prefs } = usePreferences();
  const [params, setParams] = useUrlState(listSchema);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const all = useMemo(() => sortBudgets(list.map((b) => budgetStats(b))), [list]);
  const counts = useMemo(() => periodCounts(all), [all]);
  const shown = useMemo(() => filterByPeriod(all, params.period), [all, params.period]);
  const o = useMemo(() => overall(shown), [shown]);
  const selected = shown.find((s) => s.id === params.open) ?? shown[0];
  const currency = shown.find((s) => s.currency)?.currency ?? prefs.default_currency;
  const scope =
    params.period === 'ALL' ? 'All active budgets' : `${PERIOD_LABEL[params.period]} budgets`;

  return (
    <>
      <PeriodFilter
        value={params.period}
        counts={counts}
        onChange={(period) => setParams({ period, open: undefined })}
      />
      <PanelGrid>
        <GridCell span={5} spanMd={12}>
          <OverallPanel o={o} scope={scope} currency={currency} />
        </GridCell>
        <GridCell span={7} spanMd={12}>
          <PaceMonitor list={shown} />
        </GridCell>
        <GridCell span={8} spanMd={12}>
          <Panel
            title="Budgets"
            actions={<span className={styles.micro}>{shown.length} shown</span>}
            flush
          >
            {shown.length ? (
              <div className={`${styles.grid} moc-stagger`}>
                {shown.map((s) => (
                  <BudgetCard
                    key={s.id}
                    s={s}
                    categories={catMap}
                    selected={s.id === selected?.id}
                    onSelect={(open) => setParams({ open })}
                  />
                ))}
                {shown.length % 2 ? <div className={styles.filler} aria-hidden /> : null}
              </div>
            ) : (
              <EmptyState
                compact
                title="No budgets for this period"
                action={
                  <Button onClick={() => setParams({ period: 'ALL', open: undefined })}>
                    Show all
                  </Button>
                }
              />
            )}
          </Panel>
        </GridCell>
        <GridCell span={4} spanMd={12}>
          <div className={styles.side}>
            {selected ? (
              <SidePanel key={selected.id} s={selected} categories={catMap} />
            ) : (
              <Panel title="Budget detail">
                <EmptyState compact title="Nothing selected" />
              </Panel>
            )}
          </div>
        </GridCell>
      </PanelGrid>
    </>
  );
}

function SidePanel({ s, categories }: { s: BudgetStats; categories: Map<string, Category> }) {
  const dialogs = useBudgetDialogs();
  const b = s.budget;
  return (
    <Panel
      title="Budget detail"
      actions={
        <>
          <Button
            size={ControlSize.Sm}
            icon={<Pencil aria-hidden />}
            onClick={() => dialogs.openEdit(b)}
          >
            Edit
          </Button>
          <IconButton
            size={ControlSize.Sm}
            label={`Delete ${b.name}`}
            icon={<Trash2 aria-hidden />}
            onClick={() => dialogs.confirmDelete(b)}
          />
        </>
      }
    >
      <BudgetSummary s={s} categories={categories} />
      {s.active ? (
        <section className={styles.sideSection} aria-labelledby={`count-${s.id}`}>
          <h3 className={styles.kicker} id={`count-${s.id}`}>
            Counting toward this budget
          </h3>
          <CountingList s={s} />
        </section>
      ) : null}
      <section className={styles.sideSection} aria-labelledby={`ranges-${s.id}`}>
        <h3 className={styles.kicker} id={`ranges-${s.id}`}>
          Range history
        </h3>
        <RangeHistory budget={b} compact />
      </section>
      <div className={styles.sumLinks}>
        <Link
          to={`/budgets/${s.id}`}
          className={buttonClass(ButtonVariant.Secondary, ControlSize.Md)}
        >
          <ExternalLink aria-hidden />
          Open budget
        </Link>
      </div>
    </Panel>
  );
}

function ListSkeleton() {
  return (
    <PanelGrid>
      <GridCell span={5} spanMd={12}>
        <Panel title="Overall">
          <Skeleton height={168} width={168} />
        </Panel>
      </GridCell>
      <GridCell span={7} spanMd={12}>
        <Panel title="Pace monitor">
          <Skeleton height={220} />
        </Panel>
      </GridCell>
      <GridCell span={8} spanMd={12}>
        <Panel title="Budgets" flush>
          <div className={`${styles.skelCards} moc-stagger`}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={styles.skelCard}>
                <Skeleton height={80} width={80} />
                <div className={styles.skelLines}>
                  <Skeleton width="50%" />
                  <Skeleton lines={2} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </GridCell>
      <GridCell span={4} spanMd={12}>
        <Panel title="Budget detail">
          <Skeleton height={36} width="70%" />
          <Skeleton lines={5} />
        </Panel>
      </GridCell>
    </PanelGrid>
  );
}
