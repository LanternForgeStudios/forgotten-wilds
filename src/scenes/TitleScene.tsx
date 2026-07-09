import { useState, type FormEvent } from 'react';
import { Panel } from '@/components/common/Panel';
import { getAssetUrl } from '@/assets/assetManager';
import {
  authErrorMessage,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '@/firebase/auth';
import styles from './TitleScene.module.css';

type Mode = 'signIn' | 'signUp';

export function TitleScene() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function withBusy(fn: () => Promise<void>) {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function handleGoogle() {
    void withBusy(() => signInWithGoogle().then(() => undefined));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void withBusy(async () => {
      if (mode === 'signIn') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    });
  }

  function handleForgotPassword() {
    if (!email) {
      setError('Enter your email above first, then tap "Forgot password".');
      return;
    }
    void withBusy(async () => {
      await sendPasswordReset(email);
      setInfo('Password reset email sent.');
    });
  }

  return (
    <div className={styles.wrap} style={{ backgroundImage: `url(${getAssetUrl('background.title-screen')})` }}>
      <Panel className={styles.panel}>
        <button type="button" className={styles.button} onClick={handleGoogle} disabled={busy}>
          Sign in with Google
        </button>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className={styles.input}
          />
          <button type="submit" className={styles.button} disabled={busy}>
            {mode === 'signIn' ? 'Sign in with Email' : 'Create Account'}
          </button>
        </form>

        <button
          type="button"
          className={styles.linkButton}
          onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
        >
          {mode === 'signIn' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
        <button type="button" className={styles.linkButton} onClick={handleForgotPassword} disabled={busy}>
          Forgot password?
        </button>

        {error && <p className={styles.error}>{error}</p>}
        {info && <p className={styles.info}>{info}</p>}
      </Panel>
    </div>
  );
}
