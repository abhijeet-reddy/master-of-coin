import { useContext, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PageActionsContext, usePageMeta } from './routeMeta';
import styles from './Shell.module.css';

/** Crumb line, page title and an actions slot (filled via <PageActions>); the page body follows. */
export function PageFrame({ children }: { children: ReactNode }) {
  const { title, crumbs } = usePageMeta();
  const slot = useContext(PageActionsContext);
  const { pathname } = useLocation();
  return (
    <>
      <i key={`scan-${pathname}`} className="moc-route-scan" aria-hidden />
      <header key={pathname} className={styles.phead}>
        <div className={styles.pheadMain}>
          {crumbs.length ? (
            <nav aria-label="Breadcrumb">
              <ol className={styles.crumbs}>
                {crumbs.map((c, i) => (
                  <li key={`${c.label}-${i}`}>
                    {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
                    <span className={styles.crumbSep} aria-hidden>
                      /
                    </span>
                  </li>
                ))}
                <li aria-current="page">{title}</li>
              </ol>
            </nav>
          ) : (
            <p className={styles.crumbs} aria-hidden>
              Master of Coin
            </p>
          )}
          <h1 className={styles.title}>
            {title}
            <span className={styles.cur} aria-hidden />
          </h1>
        </div>
        <div className={styles.actions} ref={slot?.setTarget} />
      </header>
      {children}
    </>
  );
}
