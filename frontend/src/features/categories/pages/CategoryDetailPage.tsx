import { Pencil, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Category } from '@/api/types';
import { PageActions } from '@/app/shell/PageActions';
import { useSetPageMeta } from '@/app/shell/routeMeta';
import { BarChart } from '@/charts';
import { CategoryLedger } from '@/features/transactions';
import type { PanelQuery } from '@/lib/panelQuery';
import { usePreferences } from '@/lib/preferences';
import {
  Badge,
  Button,
  buttonClass,
  ButtonVariant,
  ControlSize,
  EmptyState,
  ErrorState,
  GridCell,
  Money,
  Panel,
  PanelGrid,
  PanelState,
  Skeleton,
  Stat,
  StatGroup,
} from '@/ui';
import { CategoryDialogsProvider } from '../components/CategoryDialogsProvider';
import { CategoryTile } from '../components/CategoryTile';
import { useCategoryDialogs } from '../hooks/categoryDialogs';
import { useCategory, useSpend } from '../hooks/useCategoryQueries';
import { monthlySpend, monthTick, spendStats, vsAverageLabel } from '../lib/categoriesModel';
import styles from '../components/Categories.module.css';
import { cx } from '@/ui/cx';

const MONTHS = 12;

/** `/categories/:id`: identity, twelve months of spend, and the category's transactions. */
export function CategoryDetailPage() {
  return (
    <CategoryDialogsProvider>
      <CategoryDetailView />
    </CategoryDialogsProvider>
  );
}

function CategoryDetailView() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const dialogs = useCategoryDialogs();
  const q = useCategory(id);
  const c = q.category;
  useSetPageMeta(c?.name, [{ label: 'Categories', to: '/categories' }]);

  if (q.error && !q.data)
    return (
      <div className={styles.page}>
        <Panel>
          <ErrorState
            error={q.error}
            title="Could not load this category"
            onRetry={() => void q.refetch()}
          />
        </Panel>
      </div>
    );
  if (q.notFound)
    return (
      <div className={styles.page}>
        <Panel>
          <EmptyState
            title="Category not found"
            description="It may have been deleted."
            action={
              <Link
                to="/categories"
                className={buttonClass(ButtonVariant.Secondary, ControlSize.Md)}
              >
                Back to categories
              </Link>
            }
          />
        </Panel>
      </div>
    );
  if (!c) return <DetailSkeleton />;

  return (
    <div className={styles.page}>
      <PageActions>
        <Button icon={<Pencil aria-hidden />} onClick={() => dialogs.openEdit(c)}>
          Edit
        </Button>
        <Button
          icon={<Trash2 aria-hidden />}
          onClick={() => dialogs.confirmDelete(c, () => void navigate('/categories'))}
        >
          Delete
        </Button>
      </PageActions>
      <PanelGrid>
        <GridCell span={4} spanMd={12}>
          <IdentityPanel category={c} />
        </GridCell>
        <GridCell span={8} spanMd={12}>
          <SpendPanel category={c} />
        </GridCell>
      </PanelGrid>
      <section aria-label={`Transactions in ${c.name}`} className={cx(styles.ledger, 'moc-sweep')}>
        <CategoryLedger category={c} />
      </section>
    </div>
  );
}

function IdentityPanel({ category: c }: { category: Category }) {
  return (
    <Panel title="Category">
      <div className={styles.identity}>
        <CategoryTile category={c} large />
        <div>
          <p className={styles.previewName}>{c.name}</p>
          <div className={styles.tags}>
            {c.is_excluded_from_analysis ? (
              <Badge>Excluded from analysis</Badge>
            ) : (
              <Badge>In analysis</Badge>
            )}
          </div>
        </div>
      </div>
      <dl className={`${styles.facts} moc-stagger`}>
        <div>
          <dt>Icon</dt>
          <dd>{c.icon || 'None'}</dd>
        </div>
        <div>
          <dt>Colour</dt>
          <dd>{c.color ? c.color.toUpperCase() : 'None'}</dd>
        </div>
      </dl>
      {c.is_excluded_from_analysis ? (
        <p className={styles.note}>
          Its transactions are left out of the dashboard, reports and all-spending budgets.
        </p>
      ) : null}
    </Panel>
  );
}

function SpendPanel({ category }: { category: Category }) {
  const { fmt } = usePreferences();
  const spend = useSpend(MONTHS, category.id);
  const { axis, ctx } = spend;
  const model = useMemo(() => {
    const rows = spend.query.data?.data;
    if (!rows || !ctx.ready) return undefined;
    const m = monthlySpend(rows, axis, ctx);
    return { ...m, stats: spendStats(m.series) };
  }, [spend.query.data, ctx, axis]);
  const query: PanelQuery<NonNullable<typeof model>> = {
    data: model,
    isPending: !model && !spend.query.error,
    error: spend.query.error,
    refetch: () => void spend.query.refetch(),
  };
  const crossesYear = axis[0].slice(0, 4) !== axis[axis.length - 1].slice(0, 4);
  const cur = ctx.base;

  return (
    <Panel title={`Spend, last ${MONTHS} months`}>
      <PanelState
        query={query}
        skeleton={
          <>
            <Skeleton height={48} />
            <Skeleton height={220} />
          </>
        }
      >
        {(m) => (
          <div className={styles.stats}>
            <StatGroup label="Spend summary">
              <Stat
                label="This month"
                value={<Money amount={m.stats.thisMonth} currency={cur} />}
                foot={vsAverageLabel(m.stats.thisMonth, m.stats.earlierAverage)}
              />
              <Stat
                label="Monthly average"
                value={<Money amount={m.stats.average} currency={cur} />}
              />
              <Stat
                label={`Total, ${MONTHS} months`}
                value={<Money amount={m.stats.total} currency={cur} />}
              />
              <Stat
                label="Peak month"
                value={m.stats.peak ? <Money amount={m.stats.peak.total} currency={cur} /> : 'None'}
                foot={m.stats.peak ? monthTick(m.stats.peak.month, true) : undefined}
              />
            </StatGroup>
            {m.stats.total > 0 ? (
              <BarChart
                title={`${category.name} spend per month`}
                height={220}
                labels={axis.map((mo) => monthTick(mo, crossesYear))}
                series={[
                  {
                    key: 'spend',
                    label: 'Spend',
                    values: m.series.map((s) => s.total),
                    color: category.color ?? undefined,
                  },
                ]}
                format={(n) => fmt.money(n, cur)}
                axisFormat={(n) => fmt.money(n, cur, { compact: true })}
              />
            ) : (
              <EmptyState compact title="No spend in the last 12 months" />
            )}
            {spend.truncated ? (
              <p className={styles.note}>Too many transactions to load; the totals are partial.</p>
            ) : null}
            {m.missing.length ? (
              <p className={styles.note}>
                No exchange rate for {m.missing.join(', ')}; those transactions are left out.
              </p>
            ) : null}
          </div>
        )}
      </PanelState>
    </Panel>
  );
}

function DetailSkeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <span className="sr-only">Loading</span>
      <PanelGrid>
        <GridCell span={4} spanMd={12}>
          <Panel title="Category">
            <Skeleton height={56} width="60%" />
            <Skeleton lines={3} />
          </Panel>
        </GridCell>
        <GridCell span={8} spanMd={12}>
          <Panel title={`Spend, last ${MONTHS} months`}>
            <Skeleton height={260} />
          </Panel>
        </GridCell>
      </PanelGrid>
    </div>
  );
}
