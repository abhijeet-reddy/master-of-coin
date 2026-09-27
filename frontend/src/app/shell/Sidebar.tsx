import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { IconButton } from '@/ui';
import { ControlSize } from '@/ui/types';
import { NAV_DIVIDER_AFTER, NAV_ITEMS } from './navItems';
import { UserBlock } from './UserBlock';
import { useVersionLabel } from './useVersionLabel';
import styles from './Shell.module.css';

export function Brand() {
  return (
    <div className={styles.brand}>
      <span className={styles.brandMark} aria-hidden>
        MC
      </span>
      <span className={styles.brandName}>
        Master of Coin
        <small>Fin/Terminal</small>
      </span>
    </div>
  );
}

/** Primary nav list; shared by the desktop sidebar and the phone "More" sheet. */
export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ul className={styles.nav} role="list">
      {NAV_ITEMS.map((item, i) => {
        const Icon = item.icon;
        return (
          <li key={item.to}>
            <NavLink to={item.to} title={item.label} onClick={onNavigate}>
              <span className={styles.idx} aria-hidden>
                {String(i + 1).padStart(2, '0')}
              </span>
              <Icon aria-hidden />
              <span className={styles.lbl}>{item.label}</span>
            </NavLink>
            {i === NAV_DIVIDER_AFTER ? <hr aria-hidden className={styles.rule} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const version = useVersionLabel();
  return (
    <aside className={styles.side} aria-label="Sidebar">
      <Brand />
      <nav aria-label="Primary" className={styles.navWrap}>
        <NavList />
      </nav>
      <div className={styles.sideFoot}>
        <UserBlock />
        <div className={styles.sideCtl}>
          <span className={styles.ver}>
            {version ? (
              <>
                <i className={styles.verDot} aria-hidden />
                <span className={styles.verText}>{version}</span>
              </>
            ) : null}
          </span>
          <IconButton
            label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            icon={collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            size={ControlSize.Sm}
            aria-expanded={!collapsed}
            onClick={onToggle}
          />
        </div>
      </div>
    </aside>
  );
}
