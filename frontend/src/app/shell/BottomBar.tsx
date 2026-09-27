import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu as MenuIcon } from 'lucide-react';
import { Sheet } from '@/ui';
import { BOTTOM_BAR_COUNT, NAV_ITEMS } from './navItems';
import { NavList } from './Sidebar';
import { UserBlock } from './UserBlock';
import styles from './Shell.module.css';

/** Phone navigation: four destinations plus "More", which opens the full list in a sheet. */
export function BottomBar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const inMore = NAV_ITEMS.slice(BOTTOM_BAR_COUNT).some((i) => pathname.startsWith(i.to));
  return (
    <>
      <nav className={styles.bottombar} aria-label="Primary, mobile">
        {NAV_ITEMS.slice(0, BOTTOM_BAR_COUNT).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} aria-label={item.label}>
              <Icon aria-hidden />
              <span aria-hidden>{item.short ?? item.label}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          data-current={inMore || undefined}
          onClick={() => setOpen(true)}
        >
          <MenuIcon aria-hidden />
          <span>More</span>
        </button>
      </nav>
      <Sheet open={open} onOpenChange={setOpen} title="Menu">
        <nav aria-label="All pages" className={styles.sheetNav}>
          <NavList onNavigate={() => setOpen(false)} />
        </nav>
        <div className={styles.sheetUser}>
          <UserBlock />
        </div>
      </Sheet>
    </>
  );
}
