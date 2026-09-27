import { ExternalLink, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Category } from '@/api/types';
import { Badge, ControlSize, IconButton, Menu, MenuItem, MenuSeparator } from '@/ui';
import { useCategoryDialogs } from '../hooks/categoryDialogs';
import { CategoryTile } from './CategoryTile';
import styles from './Categories.module.css';

interface Props {
  category: Category;
  thisMonth: ReactNode;
  lastMonth: ReactNode;
}

/** One category: tile, name (opens the detail page), exclusion, colour and recent spend. */
export function CategoryCard({ category: c, thisMonth, lastMonth }: Props) {
  const navigate = useNavigate();
  const dialogs = useCategoryDialogs();
  return (
    <article className={styles.card} aria-labelledby={`cat-${c.id}`}>
      <CategoryTile category={c} />
      <div className={styles.cardMain}>
        <h3 className={styles.cardName}>
          <Link id={`cat-${c.id}`} to={`/categories/${c.id}`}>
            {c.name}
          </Link>
        </h3>
        <div className={styles.tags}>
          {c.is_excluded_from_analysis ? <Badge>Excluded from analysis</Badge> : null}
          {c.color ? (
            <span className={styles.hex}>
              <span
                className={styles.swatch}
                style={{ '--c': c.color } as CSSProperties}
                aria-hidden
              />
              {c.color.toUpperCase()}
            </span>
          ) : (
            <span className={styles.hex}>No colour</span>
          )}
        </div>
        <dl className={styles.figs}>
          <div>
            <dt>This month</dt>
            <dd>{thisMonth}</dd>
          </div>
          <div>
            <dt>Last month</dt>
            <dd>{lastMonth}</dd>
          </div>
        </dl>
      </div>
      <span className={styles.cardTools}>
        <Menu
          label={`Actions for ${c.name}`}
          trigger={
            <IconButton
              label={`Actions for ${c.name}`}
              icon={<MoreHorizontal />}
              size={ControlSize.Sm}
            />
          }
        >
          <MenuItem
            icon={<ExternalLink aria-hidden />}
            onSelect={() => void navigate(`/categories/${c.id}`)}
          >
            Open details
          </MenuItem>
          <MenuItem icon={<Pencil aria-hidden />} onSelect={() => dialogs.openEdit(c)}>
            Edit
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Trash2 aria-hidden />} danger onSelect={() => dialogs.confirmDelete(c)}>
            Delete
          </MenuItem>
        </Menu>
      </span>
    </article>
  );
}
