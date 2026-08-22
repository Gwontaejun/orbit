import { useState } from 'react';
import { useAuth } from '../model/use-auth';
import styles from './AuthControls.module.css';

export function AuthControls() {
  const { isConfigured, isLoading, user, signInWithGoogle, signOut } =
    useAuth();
  const [error, setError] = useState<string | null>(null);

  if (!isConfigured) return <span className={styles.demoBadge}>DEMO MODE</span>;
  if (isLoading)
    return <span className={styles.authStatus}>Checking session…</span>;

  if (user) {
    const displayName = [
      user.user_metadata.full_name,
      user.user_metadata.name,
      user.user_metadata.user_name,
      user.user_metadata.preferred_username,
    ].find(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    );
    const userLabel = displayName ?? user.email?.split('@')[0] ?? 'Signed in';

    return (
      <div className={styles.authControls}>
        <span title={user.email ?? undefined}>Signed in as {userLabel}</span>
        <button type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className={styles.authControls}>
      <button
        type="button"
        onClick={() => {
          setError(null);
          void signInWithGoogle().catch((authError: unknown) => {
            setError(
              authError instanceof Error
                ? authError.message
                : 'Unable to sign in',
            );
          });
        }}
      >
        Continue with Google
      </button>
      {error && <span className={styles.authError}>{error}</span>}
    </div>
  );
}
