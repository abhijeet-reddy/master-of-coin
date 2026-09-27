import { useMemo, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Moon, Sun, WifiOff } from 'lucide-react';
import { IconButton } from '@/ui';
import { ResolvedTheme, useTheme } from '@/design';
import { useBankConnectReturn } from '@/features/accounts';
import { BottomBar } from './BottomBar';
import { PageFrame } from './PageFrame';
import {
  PageActionsContext,
  PageMetaContext,
  usePageMeta,
  type PageMetaOverride,
} from './routeMeta';
import { Sidebar } from './Sidebar';
import { StatusStrip } from './StatusStrip';
import { useDocumentTitleSync } from './useDocumentTitleSync';
import { useOnline } from './useOnline';
import { useSidebarCollapsed } from './useSidebarCollapsed';
import { RouteErrorBoundary } from '../errors/RouteErrorBoundary';
import { BootSplash } from './BootSplash';
import styles from './Shell.module.css';

/** Sidebar (bottom bar on phones), status strip and page frame around every signed-in route. */
export function AppShell() {
  const [override, setOverride] = useState<PageMetaOverride | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const meta = useMemo(() => ({ override, setOverride }), [override]);
  const actions = useMemo(() => ({ target, setTarget }), [target]);
  return (
    <PageMetaContext.Provider value={meta}>
      <PageActionsContext.Provider value={actions}>
        <ShellLayout />
      </PageActionsContext.Provider>
    </PageMetaContext.Provider>
  );
}

function ShellLayout() {
  const { collapsed, toggle } = useSidebarCollapsed();
  const { title } = usePageMeta();
  useDocumentTitleSync(title);
  useBankConnectReturn();
  return (
    <>
      <a className={styles.skip} href="#page">
        Skip to content
      </a>
      <div className={styles.app} data-collapsed={collapsed || undefined}>
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        <div className={styles.main}>
          <TopBar />
          <OfflineBanner />
          <main id="page" className={styles.page} tabIndex={-1}>
            <PageFrame>
              <RouteErrorBoundary>
                <Outlet />
              </RouteErrorBoundary>
            </PageFrame>
          </main>
        </div>
      </div>
      <BottomBar />
      <BootSplash />
    </>
  );
}

function TopBar() {
  const { theme, toggle } = useTheme();
  const light = theme === ResolvedTheme.Light;
  return (
    <header className={styles.top}>
      <div className={styles.topMain}>
        <Link className={styles.mobBrand} to="/dashboard" aria-label="Master of Coin, dashboard">
          <span className={styles.brandMark} aria-hidden>
            MC
          </span>
          <span className={styles.mobName} aria-hidden>
            MoC
          </span>
        </Link>
        <StatusStrip />
      </div>
      <div className={styles.topActions}>
        <IconButton
          label={light ? 'Switch to dark theme' : 'Switch to light theme'}
          icon={light ? <Moon /> : <Sun />}
          onClick={toggle}
        />
      </div>
    </header>
  );
}

function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className={styles.offline} role="status">
      <WifiOff aria-hidden />
      <span>
        Offline. Showing the last data loaded; changes will fail until the connection is back.
      </span>
    </div>
  );
}
