import { atom } from 'nanostores';
import type { UserProfile } from '../lib/auth';
import type { Auth, GoogleAuthProvider, GithubAuthProvider } from 'firebase/auth';

export interface AuthState {
  loading: boolean;
  isSignedIn: boolean;
  githubUsername: string | null;
  isApproved: boolean;
  profile: UserProfile | null;
  user: any;
}

export const $authState = atom<AuthState>({
  loading: true,
  isSignedIn: false,
  githubUsername: null,
  isApproved: false,
  profile: null,
  user: null,
});

let _unsub: (() => void) | null = null;
let _authRef: Auth | null = null;
let _authModRef: typeof import('firebase/auth') | null = null;
let _googleProviderRef: GoogleAuthProvider | null = null;
let _githubProviderRef: GithubAuthProvider | null = null;
let _initialized = false;

export function initAuth() {
  if (typeof window === 'undefined') return;
  if (_initialized) return;
  _initialized = true;

  (async () => {
    try {
      const fb = await import('../lib/firebase');
      const authMod = await import('firebase/auth');
      const { getGitHubUsername, isApproved, createOrUpdateUserProfile, getUserProfile } = await import('../lib/auth');

      const auth = fb.getAuthInstance();
      if (!auth) {
        $authState.set({ ...$authState.get(), loading: false });
        return;
      }

      _authRef = auth;
      _authModRef = authMod;
      _googleProviderRef = fb.getGoogleProvider();
      _githubProviderRef = fb.getGithubProvider();

      _unsub = authMod.onAuthStateChanged(auth, async (u: any) => {
        if (u) {
          const provider = u.providerData?.[0]?.providerId;
          const authProvider = provider === 'google.com' ? 'google' : 'github';

          try {
            const userProfile = await createOrUpdateUserProfile(u, authProvider);
            const username = userProfile.githubUsername || getGitHubUsername(u);
            let approved = false;

            if (username) {
              approved = await isApproved(username);
            } else {
              approved = true;
            }

            $authState.set({
              loading: false,
              isSignedIn: true,
              githubUsername: username,
              isApproved: approved,
              profile: userProfile,
              user: u,
            });
          } catch (e) {
            console.warn('Failed to create/update profile:', e);
            const username = getGitHubUsername(u);
            let approved = false;
            if (username) {
              approved = await isApproved(username);
            }
            $authState.set({
              loading: false,
              isSignedIn: true,
              githubUsername: username,
              isApproved: approved,
              profile: null,
              user: u,
            });
          }
        } else {
          $authState.set({
            loading: false,
            isSignedIn: false,
            githubUsername: null,
            isApproved: false,
            profile: null,
            user: null,
          });
        }
      });
    } catch (e) {
      console.warn('AuthStore: Firebase not configured:', e);
      $authState.set({ ...$authState.get(), loading: false });
    }
  })();
}

export async function signInWithGoogle() {
  if (!_authRef || !_authModRef || !_googleProviderRef) {
    console.error('[Auth] Firebase not initialized yet');
    return;
  }
  try {
    await _authModRef.signInWithPopup(_authRef, _googleProviderRef);
  } catch (err: any) {
    console.error('[Auth] Google sign-in failed:', err?.code, err?.message);
    alert(`Sign-in failed: ${err?.message || err}`);
  }
}

export async function signInWithGitHub() {
  if (!_authRef || !_authModRef || !_githubProviderRef) {
    console.error('[Auth] Firebase not initialized yet');
    return;
  }
  try {
    await _authModRef.signInWithPopup(_authRef, _githubProviderRef);
  } catch (err: any) {
    console.error('[Auth] GitHub sign-in failed:', err?.code, err?.message);
    alert(`Sign-in failed: ${err?.message || err}`);
  }
}

export async function signOut() {
  if (!_authRef || !_authModRef) return;
  await _authModRef.signOut(_authRef);
}

export async function refreshProfile() {
  const state = $authState.get();
  if (!state.user) {
    $authState.set({ ...state, profile: null });
    return;
  }

  try {
    const { getUserProfile } = await import('../lib/auth');
    const userProfile = await getUserProfile(state.user.uid);
    $authState.set({ ...state, profile: userProfile });
  } catch (e) {
    console.warn('Failed to refresh profile:', e);
  }
}
