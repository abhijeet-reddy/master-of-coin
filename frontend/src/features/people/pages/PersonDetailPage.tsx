import { HandCoins, Pencil, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageActions } from '@/app/shell/PageActions';
import { useSetPageMeta } from '@/app/shell/routeMeta';
import { PersonLedger } from '@/features/transactions';
import { toApiError } from '@/api/client';
import {
  Button,
  buttonClass,
  ButtonVariant,
  ControlSize,
  EmptyState,
  ErrorState,
  GridCell,
  Panel,
  PanelGrid,
  Skeleton,
} from '@/ui';
import { BalancePanel, DebtHistoryPanel, SplitLinkPanel } from '../components/DetailPanels';
import { PeopleDialogsProvider } from '../components/PeopleDialogsProvider';
import { usePeopleDialogs } from '../hooks/peopleDialogs';
import { usePersonWithBalance } from '../hooks/usePeopleQueries';
import { DebtDirection, personNet } from '../lib/peopleModel';
import styles from '../components/People.module.css';
import { cx } from '@/ui/cx';

/** `/people/:id`: the balance, its history, the split provider link and the shared transactions. */
export function PersonDetailPage() {
  return (
    <PeopleDialogsProvider>
      <PersonDetailView />
    </PeopleDialogsProvider>
  );
}

function PersonDetailView() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const dialogs = usePeopleDialogs();
  const q = usePersonWithBalance(id);
  const p = q.data;
  useSetPageMeta(p?.name, [{ label: 'People', to: '/people' }]);

  if (q.error && !p)
    return (
      <div className={styles.page}>
        <Panel>
          {toApiError(q.error).status === 404 ? (
            <EmptyState
              title="Person not found"
              description="They may have been deleted."
              action={
                <Link to="/people" className={buttonClass(ButtonVariant.Secondary, ControlSize.Md)}>
                  Back to people
                </Link>
              }
            />
          ) : (
            <ErrorState
              error={q.error}
              title="Could not load this person"
              onRetry={() => void q.refetch()}
            />
          )}
        </Panel>
      </div>
    );
  if (!p) return <DetailSkeleton />;
  const settled = personNet(p).direction === DebtDirection.Settled;

  return (
    <div className={styles.page}>
      <PageActions>
        <Button
          variant={ButtonVariant.Primary}
          icon={<HandCoins aria-hidden />}
          disabled={settled}
          onClick={() => dialogs.openSettle(p)}
        >
          Settle up
        </Button>
        <Button icon={<Pencil aria-hidden />} onClick={() => dialogs.openEdit(p)}>
          Edit
        </Button>
        <Button
          icon={<Trash2 aria-hidden />}
          onClick={() => dialogs.confirmDelete(p, () => void navigate('/people'))}
        >
          Delete
        </Button>
      </PageActions>
      <PanelGrid>
        <GridCell span={4} spanMd={12}>
          <div className={styles.side}>
            <BalancePanel person={p} />
            <SplitLinkPanel person={p} />
          </div>
        </GridCell>
        <GridCell span={8} spanMd={12}>
          <DebtHistoryPanel person={p} ctx={q.ctx} />
        </GridCell>
      </PanelGrid>
      <section
        aria-label={`Transactions shared with ${p.name}`}
        className={cx(styles.ledger, 'moc-sweep')}
      >
        <PersonLedger person={p} />
      </section>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <span className="sr-only">Loading</span>
      <PanelGrid>
        <GridCell span={4} spanMd={12}>
          <Panel title="Balance">
            <Skeleton height={56} width="60%" />
            <Skeleton lines={5} />
          </Panel>
        </GridCell>
        <GridCell span={8} spanMd={12}>
          <Panel title="Debt history">
            <Skeleton height={260} />
          </Panel>
        </GridCell>
      </PanelGrid>
    </div>
  );
}
