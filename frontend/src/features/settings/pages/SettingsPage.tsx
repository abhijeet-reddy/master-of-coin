import { TabPanel, Tabs } from '@/ui';
import { AboutTab } from '../components/AboutTab';
import { ApiKeysTab } from '../components/ApiKeysTab';
import { IntegrationsTab } from '../components/IntegrationsTab';
import { PreferencesTab } from '../components/PreferencesTab';
import { ProfileTab } from '../components/ProfileTab';
import { SecurityTab } from '../components/SecurityTab';
import { useSettingsParams } from '../hooks/useSettingsParams';
import { SETTINGS_TAB_LABEL, SETTINGS_TABS, SettingsTab } from '../lib/settingsTabs';
import styles from '../components/Settings.module.css';

const ITEMS = SETTINGS_TABS.map((t) => ({ value: t, label: SETTINGS_TAB_LABEL[t] }));

const BODY: Record<SettingsTab, () => React.JSX.Element> = {
  [SettingsTab.Profile]: ProfileTab,
  [SettingsTab.Preferences]: PreferencesTab,
  [SettingsTab.Security]: SecurityTab,
  [SettingsTab.Integrations]: IntegrationsTab,
  [SettingsTab.ApiKeys]: ApiKeysTab,
  [SettingsTab.About]: AboutTab,
};

/** `/settings`: one tab at a time, named in `?tab=`. */
export function SettingsPage() {
  const { tab, setTab } = useSettingsParams();
  return (
    <div className={styles.page}>
      <Tabs value={tab} onValueChange={setTab} items={ITEMS} label="Settings">
        {SETTINGS_TABS.map((t) => {
          const Body = BODY[t];
          return (
            <TabPanel key={t} value={t}>
              {t === tab ? <Body /> : null}
            </TabPanel>
          );
        })}
      </Tabs>
    </div>
  );
}
