import { Plus, Search } from 'lucide-react';
import { useId, useMemo } from 'react';
import { z } from 'zod';
import { PageActions } from '@/app/shell/PageActions';
import { usePreferences } from '@/lib/preferences';
import { u, useUrlState } from '@/lib/urlState';
import {
  Button,
  ButtonVariant,
  EmptyState,
  Field,
  Input,
  Money,
  Panel,
  PanelState,
  Select,
  SignDisplay,
  Skeleton,
  Stat,
  StatGroup,
} from '@/ui';
import { PeopleDialogsProvider } from '../components/PeopleDialogsProvider';
import { PersonRow } from '../components/PersonRow';
import { usePeopleDialogs } from '../hooks/peopleDialogs';
import { usePeopleWithBalances } from '../hooks/usePeopleQueries';
import type { PersonWithBalance } from '@/lib/debtCurrency';
import {
  filterPeople,
  PEOPLE_SHOWS,
  PEOPLE_SORTS,
  peopleTotals,
  personNet,
  sortPeople,
  type PeopleShow,
  type PeopleSort,
} from '../lib/peopleModel';
import styles from '../components/People.module.css';

const SHOW_LABEL: Record<PeopleShow, string> = {
  all: 'All',
  'owes-me': 'Owe you',
  'i-owe': 'You owe',
  settled: 'Settled',
};
const SORT_LABEL: Record<PeopleSort, string> = { balance: 'Largest balance', name: 'Name' };

const listSchema = z.object({
  q: u.string(),
  show: u.enum(PEOPLE_SHOWS, 'all'),
  sort: u.enum(PEOPLE_SORTS, 'balance'),
});

/** `/people`: who owes whom, and everyone you share expenses with. */
export function PeoplePage() {
  return (
    <PeopleDialogsProvider>
      <PeopleView />
    </PeopleDialogsProvider>
  );
}

function AddButton() {
  const dialogs = usePeopleDialogs();
  return (
    <Button
      variant={ButtonVariant.Primary}
      icon={<Plus aria-hidden />}
      onClick={() => dialogs.openCreate()}
    >
      Add person
    </Button>
  );
}

function PeopleView() {
  const people = usePeopleWithBalances();
  return (
    <div className={styles.page}>
      <PageActions>
        <AddButton />
      </PageActions>
      <PanelState
        query={people}
        skeleton={<ListSkeleton />}
        empty={(list) =>
          list.length === 0 ? (
            <Panel>
              <EmptyState
                title="No people yet"
                description="Add the people you split expenses with to track who owes whom."
                action={<AddButton />}
              />
            </Panel>
          ) : null
        }
      >
        {(list) => <PeopleBody list={list} />}
      </PanelState>
    </div>
  );
}

function Overview({ list }: { list: PersonWithBalance[] }) {
  const { prefs } = usePreferences();
  const t = useMemo(() => peopleTotals(list), [list]);
  const cur = prefs.default_currency;
  const missing = [...new Set(list.flatMap((p) => p.balance?.missing ?? []))];
  const foreign = list.some((p) => p.balance?.foreign);
  return (
    <Panel
      title="Debt overview"
      actions={
        foreign ? (
          <span className={styles.micro}>
            {missing.length
              ? `In ${cur}; no rate for ${missing.join(', ')}`
              : `Converted to ${cur}`}
          </span>
        ) : null
      }
    >
      <StatGroup label="Debt overview">
        <Stat label="Owed to you" value={<Money amount={t.owedToMe} currency={cur} />} />
        <Stat label="You owe" value={<Money amount={t.iOwe} currency={cur} />} />
        <Stat
          label="Net"
          value={<Money amount={t.net} currency={cur} sign={SignDisplay.Always} />}
        />
        <Stat label="Open balances" value={`${t.open} of ${list.length}`} />
      </StatGroup>
    </Panel>
  );
}

function PeopleBody({ list }: { list: PersonWithBalance[] }) {
  const [params, setParams] = useUrlState(listSchema);
  const segId = useId();
  const counts = useMemo(() => {
    const c: Record<PeopleShow, number> = {
      all: list.length,
      'owes-me': 0,
      'i-owe': 0,
      settled: 0,
    };
    for (const p of list) c[personNet(p).direction]++;
    return c;
  }, [list]);
  const shown = useMemo(
    () => sortPeople(filterPeople(list, params.show, params.q), params.sort),
    [list, params.show, params.q, params.sort]
  );

  return (
    <>
      <Overview list={list} />
      <div className={styles.filterBar}>
        <div className={styles.search}>
          <Field label="Search people" plain>
            <Input
              type="search"
              leading={<Search />}
              value={params.q}
              onChange={(e) => setParams({ q: e.target.value })}
              placeholder="Name or email"
            />
          </Field>
        </div>
        <div className={styles.tools}>
          <div className={styles.filterGroup}>
            <span className={styles.label} id={segId}>
              Show
            </span>
            <div className={styles.seg} role="group" aria-labelledby={segId}>
              {PEOPLE_SHOWS.map((s) => (
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
          <div className={styles.sort}>
            <Field label="Sort" plain>
              <Select
                value={params.sort}
                onValueChange={(sort) => setParams({ sort })}
                options={PEOPLE_SORTS.map((s) => ({ value: s, label: SORT_LABEL[s] }))}
              />
            </Field>
          </div>
        </div>
      </div>
      <Panel
        title="People"
        flush
        actions={<span className={styles.micro}>{shown.length} shown</span>}
      >
        {shown.length ? (
          <ul className={styles.list}>
            {shown.map((p) => (
              <PersonRow key={p.id} person={p} />
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            title="No people match"
            action={
              <Button onClick={() => setParams({ q: '', show: 'all' })}>Clear filters</Button>
            }
          />
        )}
      </Panel>
    </>
  );
}

function ListSkeleton() {
  return (
    <>
      <Panel title="Debt overview">
        <Skeleton height={56} />
      </Panel>
      <Panel title="People" flush>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={styles.skelRow}>
            <Skeleton width={36} height={36} />
            <Skeleton width="50%" />
            <Skeleton width={90} />
          </div>
        ))}
      </Panel>
    </>
  );
}
