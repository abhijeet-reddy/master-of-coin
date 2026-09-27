import { Panel, PanelState, Skeleton } from '@/ui';
import { useVersion } from '../hooks/useSettingsQueries';
import styles from './Settings.module.css';

/** The deployed build, from GET /version. */
export function AboutTab() {
  const version = useVersion();
  return (
    <div className={styles.tabBody}>
      <Panel title="About Master of Coin">
        <PanelState query={version} skeleton={<Skeleton lines={2} />}>
          {(v) => (
            <dl className={`${styles.facts} moc-stagger`}>
              <dt>Version</dt>
              <dd>
                {v.version === 'dev' ? 'Development build' : `v${v.version.replace(/^v/, '')}`}
              </dd>
              <dt>Commit</dt>
              <dd>{v.commit}</dd>
            </dl>
          )}
        </PanelState>
      </Panel>
    </div>
  );
}
