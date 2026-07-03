import { create } from 'zustand';
import type { User } from 'firebase/auth';
import { subscribeToAuthChanges } from '@/firebase/auth';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  user: User | null;
}

export const useAuthStore = create<AuthState>(() => ({
  status: 'loading',
  user: null,
}));

// No path into the game exists without a resolved, real auth.currentUser — this listener
// is the single source of truth App.tsx reads to gate every scene beyond the title screen.
subscribeToAuthChanges((user) => {
  useAuthStore.setState({ status: user ? 'signedIn' : 'signedOut', user });
});
