import type { CSSProperties } from 'react';
import { Layers, Tag } from 'lucide-react';
import type { BudgetHealth, Category } from '@/api/types';
import { Badge } from '@/ui';
import { HEALTH } from '../lib/health';
import styles from './Budgets.module.css';

/** OK, Warning or Exceeded, with its icon; "No range" when nothing is active. */
export function HealthBadge({ health, id }: { health: BudgetHealth | null; id?: string }) {
  if (!health) return <Badge>No range</Badge>;
  const { label, tone, Icon } = HEALTH[health];
  return (
    <span id={id}>
      <Badge tone={tone} icon={<Icon aria-hidden />}>
        {label}
      </Badge>
    </span>
  );
}

/** The budget's category with its icon and colour; overall budgets read "All spending". */
export function CategoryTag({
  categoryId,
  categories,
}: {
  categoryId?: string;
  categories: Map<string, Category>;
}) {
  const c = categoryId ? categories.get(categoryId) : undefined;
  const name = !categoryId ? 'All spending' : (c?.name ?? 'Unknown category');
  const icon = c?.icon?.trim();
  return (
    <span className={styles.cat}>
      <span
        className={styles.catIcon}
        style={c?.color ? ({ '--c': c.color } as CSSProperties) : undefined}
        aria-hidden
      >
        {!categoryId ? (
          <Layers size={12} />
        ) : icon && [...icon].length <= 2 ? (
          icon
        ) : (
          <Tag size={12} />
        )}
      </span>
      <span className={styles.catName}>{name}</span>
    </span>
  );
}
