import { MoreHorizontal, Pencil, Play, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Schedule } from '@/api/types';
import { jobTypeLabel } from '@/features/jobs';
import { DateStyle } from '@/lib/format';
import { usePreferences } from '@/lib/preferences';
import {
  Badge,
  Button,
  ControlSize,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  Switch,
  Tone,
} from '@/ui';
import { useRunScheduleNow, useToggleSchedule } from '../hooks/useScheduleQueries';
import { cronLabel } from '../lib/cron';
import styles from './Schedules.module.css';

interface Props {
  schedule: Schedule;
  onEdit: (s: Schedule) => void;
  onDelete: (s: Schedule) => void;
}

/** One schedule: what it runs, when, the last and next run, and its controls. */
export function ScheduleRow({ schedule: s, onEdit, onDelete }: Props) {
  const { fmt } = usePreferences();
  const toggle = useToggleSchedule();
  const run = useRunScheduleNow();
  const at = (v?: string) => (v ? fmt.date(v, DateStyle.DateTime) : 'Never');
  return (
    <li className={styles.row} aria-labelledby={`schedule-${s.id}`} data-paused={!s.is_active}>
      <div className={styles.main}>
        <h3 className={styles.name}>
          <Link id={`schedule-${s.id}`} to={`/schedules/${s.id}`}>
            {s.name}
          </Link>
        </h3>
        <p className={styles.sub}>
          <Badge>{jobTypeLabel(s.job_type)}</Badge>
          {s.is_active ? null : <Badge tone={Tone.Warn}>Paused</Badge>}
          <span>{cronLabel(s.cron_expr, s.cron_description)}</span>
        </p>
      </div>
      <dl className={styles.runs}>
        <div>
          <dt>Next</dt>
          <dd>{s.is_active ? at(s.next_run_at) : 'Paused'}</dd>
        </div>
        <div>
          <dt>Last</dt>
          <dd>{at(s.last_run_at)}</dd>
        </div>
      </dl>
      <div className={styles.controls}>
        <Switch
          checked={s.is_active}
          onCheckedChange={() => toggle.mutate(s)}
          disabled={toggle.isPending}
          label={<span className={styles.switchLabel}>{s.is_active ? 'Active' : 'Paused'}</span>}
        />
        <Button
          size={ControlSize.Sm}
          icon={<Play aria-hidden />}
          loading={run.isPending}
          onClick={() => run.mutate(s)}
          aria-label={`Run ${s.name} now`}
        >
          Run now
        </Button>
        <Menu
          label={`Actions for ${s.name}`}
          trigger={
            <IconButton
              label={`Actions for ${s.name}`}
              icon={<MoreHorizontal />}
              size={ControlSize.Sm}
            />
          }
        >
          <MenuItem icon={<Pencil aria-hidden />} onSelect={() => onEdit(s)}>
            Edit
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Trash2 aria-hidden />} danger onSelect={() => onDelete(s)}>
            Delete
          </MenuItem>
        </Menu>
      </div>
    </li>
  );
}
