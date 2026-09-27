import { useNavigate } from 'react-router-dom';
import { LogOut, Moon, Settings, Sun } from 'lucide-react';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/ui';
import { MenuAlign } from '@/ui/types';
import { ResolvedTheme, useTheme } from '@/design';
import { useAuth } from '../auth/authContext';
import styles from './Shell.module.css';

function initials(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .map((p) => p[0])
      .join('')
      .slice(0, 2) || '?'
  ).toUpperCase();
}

/** Avatar, name and email; opens the account menu (settings, theme, log out). */
export function UserBlock() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const light = theme === ResolvedTheme.Light;
  return (
    <Menu
      align={MenuAlign.Start}
      label="Account"
      trigger={
        <button
          type="button"
          className={styles.user}
          aria-label={`Account menu, ${user?.name ?? 'signed in'}`}
        >
          <span className={styles.avatar} aria-hidden>
            {initials(user?.name)}
          </span>
          <span className={styles.userText}>
            <b>{user?.name ?? 'Signed in'}</b>
            <span>{user?.email ?? ''}</span>
          </span>
        </button>
      }
    >
      <MenuLabel>{user?.email ?? 'Account'}</MenuLabel>
      <MenuItem icon={<Settings aria-hidden />} onSelect={() => void navigate('/settings')}>
        Settings
      </MenuItem>
      <MenuItem icon={light ? <Moon aria-hidden /> : <Sun aria-hidden />} onSelect={toggle}>
        {light ? 'Dark theme' : 'Light theme'}
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        icon={<LogOut aria-hidden />}
        danger
        onSelect={() => {
          logout();
          void navigate('/login', { replace: true });
        }}
      >
        Log out
      </MenuItem>
    </Menu>
  );
}
