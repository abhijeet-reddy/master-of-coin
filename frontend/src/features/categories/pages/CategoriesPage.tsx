import { Plus, Search } from 'lucide-react';
import { useId, useMemo } from 'react';
import { z } from 'zod';
import type { Category } from '@/api/types';
import { PageActions } from '@/app/shell/PageActions';
import { usePreferences } from '@/lib/preferences';
import { u, useUrlState } from '@/lib/urlState';
import {
  Button,
  ButtonVariant,
  ControlSize,
  EmptyState,
  Field,
  Input,
  Panel,
  PanelState,
  Skeleton,
} from '@/ui';
import { CategoryCard } from '../components/CategoryCard';
import { CategoryDialogsProvider } from '../components/CategoryDialogsProvider';
import { useCategoryDialogs } from '../hooks/categoryDialogs';
import { useCategories, useSpend } from '../hooks/useCategoryQueries';
import { monthlySpend, searchCategories, sortCategories } from '../lib/categoriesModel';
import styles from '../components/Categories.module.css';

const SHOW = ['all', 'included', 'excluded'] as const;
type Show = (typeof SHOW)[number];
const SHOW_LABEL: Record<Show, string> = {
  all: 'All',
  included: 'In analysis',
  excluded: 'Excluded',
};

const listSchema = z.object({
  q: u.string(),
  show: u.enum(SHOW, 'all'),
});

/** `/categories`: every category as a card, with this and last month's spend. */
export function CategoriesPage() {
  return (
    <CategoryDialogsProvider>
      <CategoriesView />
    </CategoryDialogsProvider>
  );
}

function CreateButton() {
  const dialogs = useCategoryDialogs();
  return (
    <Button
      variant={ButtonVariant.Primary}
      icon={<Plus aria-hidden />}
      onClick={() => dialogs.openCreate()}
    >
      Create category
    </Button>
  );
}

function CategoriesView() {
  const categories = useCategories();
  return (
    <div className={styles.page}>
      <PageActions>
        <CreateButton />
      </PageActions>
      <PanelState
        query={categories}
        skeleton={<ListSkeleton />}
        empty={(list) =>
          list.length === 0 ? (
            <Panel>
              <EmptyState
                title="No categories yet"
                description="Categories group transactions for budgets, the dashboard and reports."
                action={<CreateButton />}
              />
            </Panel>
          ) : null
        }
      >
        {(list) => <CategoriesBody list={list} />}
      </PanelState>
    </div>
  );
}

function CategoriesBody({ list }: { list: Category[] }) {
  const { fmt } = usePreferences();
  const [params, setParams] = useUrlState(listSchema);
  const segId = useId();
  const spend = useSpend(2);
  const sorted = useMemo(() => sortCategories(list), [list]);
  const counts: Record<Show, number> = useMemo(
    () => ({
      all: sorted.length,
      included: sorted.filter((c) => !c.is_excluded_from_analysis).length,
      excluded: sorted.filter((c) => c.is_excluded_from_analysis).length,
    }),
    [sorted]
  );
  const shown = useMemo(() => {
    const byShow = sorted.filter((c) =>
      params.show === 'all'
        ? true
        : params.show === 'excluded'
          ? c.is_excluded_from_analysis
          : !c.is_excluded_from_analysis
    );
    return searchCategories(byShow, params.q);
  }, [sorted, params.show, params.q]);

  const perCategory = useMemo(() => {
    const rows = spend.query.data?.data;
    if (!rows || !spend.ctx.ready) return null;
    const out = new Map<string, [number, number]>();
    for (const c of list) {
      const { series } = monthlySpend(
        rows.filter((t) => t.category_id === c.id),
        spend.axis,
        spend.ctx
      );
      out.set(c.id, [series[1].total, series[0].total]);
    }
    return out;
  }, [spend.query.data, spend.ctx, spend.axis, list]);

  const fig = (id: string, i: 0 | 1) => {
    if (spend.query.isError) return <span className={styles.dim}>--</span>;
    if (!perCategory) return <Skeleton width={60} height={12} />;
    const v = perCategory.get(id)?.[i] ?? 0;
    return v ? (
      fmt.money(v, spend.ctx.base)
    ) : (
      <span className={styles.dim}>{fmt.money(0, spend.ctx.base)}</span>
    );
  };

  return (
    <>
      <div className={styles.filterBar}>
        <div className={styles.search}>
          <Field label="Search categories" plain>
            <Input
              type="search"
              leading={<Search />}
              value={params.q}
              onChange={(e) => setParams({ q: e.target.value }, { history: 'replace' })}
              placeholder="Name"
            />
          </Field>
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.label} id={segId}>
            Show
          </span>
          <div className={styles.seg} role="group" aria-labelledby={segId}>
            {SHOW.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={params.show === s}
                onClick={() => setParams({ show: s })}
              >
                {SHOW_LABEL[s]}
                <span className={styles.segCount}>{counts[s]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <Panel
        title="Categories"
        flush
        actions={
          spend.query.isError ? (
            <Button size={ControlSize.Sm} onClick={() => void spend.query.refetch()}>
              Spend unavailable, retry
            </Button>
          ) : (
            <span className={styles.micro}>
              {shown.length} shown{spend.truncated ? ', spend partial' : ''}
            </span>
          )
        }
      >
        {shown.length ? (
          <div className={styles.grid}>
            {shown.map((c) => (
              <CategoryCard
                key={c.id}
                category={c}
                thisMonth={fig(c.id, 0)}
                lastMonth={fig(c.id, 1)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            compact
            title="No categories match"
            action={<Button onClick={() => setParams({ q: '', show: 'all' })}>Clear search</Button>}
          />
        )}
      </Panel>
    </>
  );
}

function ListSkeleton() {
  return (
    <Panel title="Categories" flush>
      <div className={styles.grid}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={styles.skelCard}>
            <Skeleton width={44} height={44} />
            <div className={styles.skelLines}>
              <Skeleton width="55%" />
              <Skeleton width="80%" height={10} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
