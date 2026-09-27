import { Tag } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Category } from '@/api/types';
import { cx } from '@/ui';
import styles from './Categories.module.css';

/** The category's emoji (or a tag glyph) with its colour as the left rule. Decorative. */
export function CategoryTile({
  category,
  large,
}: {
  category: Pick<Category, 'icon' | 'color'>;
  large?: boolean;
}) {
  const icon = category.icon?.trim();
  const style = category.color ? ({ '--c': category.color } as CSSProperties) : undefined;
  return (
    <span className={cx(styles.tile, large && styles.tileLg)} style={style} aria-hidden>
      {icon ? icon : <Tag />}
    </span>
  );
}
