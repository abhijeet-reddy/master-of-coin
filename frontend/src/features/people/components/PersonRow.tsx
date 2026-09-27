import { ExternalLink, HandCoins, Link2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { usePreferences } from '@/lib/preferences';
import { ControlSize, IconButton, Menu, MenuItem, MenuSeparator } from '@/ui';
import { usePeopleDialogs } from '../hooks/peopleDialogs';
import type { PersonWithBalance } from '@/lib/debtCurrency';
import { DebtDirection, initials, personNet } from '../lib/peopleModel';
import { DebtBadge } from './DebtBadge';
import { NativeAmounts } from './NativeAmounts';
import styles from './People.module.css';

const AMOUNT_CLASS: Record<DebtDirection, string> = {
  [DebtDirection.OwesMe]: styles.owesMe,
  [DebtDirection.IOwe]: styles.iOwe,
  [DebtDirection.Settled]: styles.settled,
};

/** One person: who, how many shared transactions, and the net either way. */
export function PersonRow({ person: p }: { person: PersonWithBalance }) {
  const navigate = useNavigate();
  const dialogs = usePeopleDialogs();
  const { prefs, fmt } = usePreferences();
  const d = personNet(p);
  const count = p.transaction_count;
  return (
    <li className={styles.row} aria-labelledby={`person-${p.id}`}>
      <span className={styles.avatar} aria-hidden>
        {initials(p.name)}
      </span>
      <div className={styles.who}>
        <h3 className={styles.name}>
          <Link id={`person-${p.id}`} to={`/people/${p.id}`}>
            {p.name}
          </Link>
        </h3>
        <p className={styles.sub}>
          <span>
            {count} shared {count === 1 ? 'transaction' : 'transactions'}
          </span>
          {p.email ? <span>{p.email}</span> : null}
        </p>
      </div>
      <div className={styles.balance}>
        <DebtBadge person={p} />
        <span className={AMOUNT_CLASS[d.direction]}>
          {fmt.money(d.amount, prefs.default_currency)}
        </span>
        <NativeAmounts balance={p.balance} />
      </div>
      <span className={styles.tools2}>
        <Menu
          label={`Actions for ${p.name}`}
          trigger={
            <IconButton
              label={`Actions for ${p.name}`}
              icon={<MoreHorizontal />}
              size={ControlSize.Sm}
            />
          }
        >
          <MenuItem
            icon={<ExternalLink aria-hidden />}
            onSelect={() => void navigate(`/people/${p.id}`)}
          >
            Open details
          </MenuItem>
          {d.direction !== DebtDirection.Settled ? (
            <MenuItem icon={<HandCoins aria-hidden />} onSelect={() => dialogs.openSettle(p)}>
              Settle up
            </MenuItem>
          ) : null}
          <MenuItem icon={<Pencil aria-hidden />} onSelect={() => dialogs.openEdit(p)}>
            Edit
          </MenuItem>
          <MenuItem icon={<Link2 aria-hidden />} onSelect={() => dialogs.openLink(p)}>
            Split provider link
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Trash2 aria-hidden />} danger onSelect={() => dialogs.confirmDelete(p)}>
            Delete
          </MenuItem>
        </Menu>
      </span>
    </li>
  );
}
