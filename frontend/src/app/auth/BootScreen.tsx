import styles from './RequireAuth.module.css';

/** Full-screen placeholder while the session or the first route chunk loads. */
export function BootScreen({ label = 'Loading' }: { label?: string }) {
  return (
    <div className={styles.boot} role="status" aria-live="polite">
      <span className={styles.mark} aria-hidden>
        MC
      </span>
      <span>{label}</span>
    </div>
  );
}
