import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageActions } from '@/app/shell/PageActions';
import {
  Button,
  buttonClass,
  ButtonVariant,
  ControlSize,
  EmptyState,
  Panel,
  PanelState,
  Skeleton,
} from '@/ui';
import { ScheduleRow } from '../components/ScheduleRow';
import { useScheduleDialogs } from '../components/useScheduleDialogs';
import { useSchedules } from '../hooks/useScheduleQueries';
import styles from '../components/Schedules.module.css';

/** `/schedules`: background jobs that run on a timetable. */
export function SchedulesPage() {
  const schedules = useSchedules();
  const d = useScheduleDialogs();
  const create = (
    <Button variant={ButtonVariant.Primary} icon={<Plus aria-hidden />} onClick={d.openCreate}>
      Create schedule
    </Button>
  );
  return (
    <div className={styles.page}>
      <PageActions>{create}</PageActions>
      <p className={styles.intro}>
        Run drift checks, portfolio syncs and bank syncs on a timetable. Timetables are set in UTC;
        next and last runs show in your local time. Every run shows up in the job history.
      </p>
      <Panel
        title="Schedules"
        flush
        actions={
          <Link to="/jobs" className={buttonClass(ButtonVariant.Ghost, ControlSize.Sm)}>
            Job history
          </Link>
        }
      >
        <PanelState
          query={schedules}
          skeleton={<ListSkeleton />}
          empty={(rows) =>
            rows.length === 0 ? (
              <EmptyState
                title="No schedules yet"
                description="Create one to run a drift check or a sync automatically."
                action={create}
              />
            ) : null
          }
        >
          {(rows) => (
            <ul className={styles.list} aria-label="Schedules">
              {rows.map((s) => (
                <ScheduleRow
                  key={s.id}
                  schedule={s}
                  onEdit={d.openEdit}
                  onDelete={d.confirmDelete}
                />
              ))}
            </ul>
          )}
        </PanelState>
      </Panel>
      {d.dialogs}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy>
      {[0, 1, 2].map((i) => (
        <div key={i} className={styles.skelRow}>
          <Skeleton lines={2} />
          <Skeleton height={28} />
          <Skeleton height={28} />
        </div>
      ))}
    </div>
  );
}
