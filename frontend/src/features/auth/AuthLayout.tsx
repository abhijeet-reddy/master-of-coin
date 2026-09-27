import type { ReactNode } from 'react';
import { CircleAlert, Moon, Sun } from 'lucide-react';
import { IconButton } from '@/ui';
import { ResolvedTheme, useTheme } from '@/design';
import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  kicker: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

/** Frame for the signed-out pages: brand bar, one centred column, theme switch. */
export function AuthLayout({ kicker, subtitle, children, footer }: AuthLayoutProps) {
  const { theme, toggle } = useTheme();
  const light = theme === ResolvedTheme.Light;
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <span className={styles.brand}>
          <span className={styles.mark} aria-hidden>
            MC
          </span>
          Personal ledger
        </span>
        <IconButton
          label={light ? 'Switch to dark theme' : 'Switch to light theme'}
          icon={light ? <Moon /> : <Sun />}
          onClick={toggle}
        />
      </header>
      <main className={styles.center}>
        <div className={styles.card}>
          <div className={styles.head}>
            <p className={styles.kicker}>{kicker}</p>
            <h1 className={styles.title}>Master of Coin</h1>
            <p className={styles.sub}>{subtitle}</p>
          </div>
          {children}
          <p className={styles.foot}>{footer}</p>
        </div>
      </main>
      <footer className={styles.bottom}>Self-hosted. Your data stays on your server.</footer>
    </div>
  );
}

/** Form-level error from the server, announced when it appears. */
export function AuthAlert({ title, message }: { title: string; message: string | null }) {
  if (!message) return null;
  return (
    <div className={styles.alert} role="alert">
      <CircleAlert aria-hidden />
      <span className={styles.alertTitle}>{title}</span>
      <span>{message}</span>
    </div>
  );
}
