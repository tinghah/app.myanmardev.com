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
  error: string | null;
}

export const $authState = atom<AuthState>({
  loading: true,
  isSignedIn: false,
  githubUsername: null,
  isApproved: false,
  profile: null,
  user: null,
  error: null,
});

let _unsub: (() => void) | null = null;
let _authRef: Auth | null = null;
let _authModRef: typeof import('firebase/auth') | null = null;
let _googleProviderRef: GoogleAuthProvider | null = null;
let _githubProviderRef: GithubAuthProvider | null = null;
let _initialized = false;

// ─── Admin Force Redirect ────────────────────────────────
// Admin accounts should ONLY see /admin pages. Never user-facing pages.

const ADMIN_ALLOWED_PATHS = ['/admin'];

function isAdminAllowedPath(pathname: string): boolean {
  return ADMIN_ALLOWED_PATHS.some((p) => pathname.includes(p));
}

function getLang(pathname: string): string {
  return pathname.startsWith('/my') ? 'my' : 'en';
}

export function redirectAdminIfNeeded(profile: UserProfile | null) {
  if (typeof window === 'undefined') return;
  if (!profile?.isAdmin) return;

  const pathname = window.location.pathname;
  if (!isAdminAllowedPath(pathname)) {
    const lang = getLang(pathname);
    window.location.href = `/${lang}/admin/users`;
  }
}

export function initAuth() {
  if (typeof window === 'undefined') return;
  if (_initialized) return;
  _initialized = true;

  (async () => {
    try {
      const fb = await import('../lib/firebase');
      const authMod = await import('firebase/auth');
      const { getGitHubUsername, isApproved, createOrUpdateUserProfile } = await import('../lib/auth');

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
          // Always check super admin status from Firebase Auth email (independent of Firestore)
          const { isSuperAdmin } = await import('../lib/auth');
          const isAdminUser = isSuperAdmin(u.email);
          console.log('[AuthStore] User email:', u.email, '| isAdmin:', isAdminUser);

          try {
            // createOrUpdateUserProfile now auto-detects provider — no undefined values
            const userProfile = await createOrUpdateUserProfile(u);
            const username = userProfile.githubUsername || getGitHubUsername(u) || null;

            // Only check approved_users for GitHub users (Google users are always approved)
            let approved = true;
            if (username) {
              approved = await isApproved(username);
            }

            $authState.set({
              loading: false,
              isSignedIn: true,
              githubUsername: username,
              isApproved: approved,
              profile: userProfile,
              user: u,
              error: null,
            });

            // Mark body as signed-in for CSS auth gating
            document.body.setAttribute('data-auth', 'signed-in');
            const shouldAdmin = userProfile.isAdmin || isAdminUser;
            console.log('[AuthStore] profile.isAdmin:', userProfile.isAdmin, '| isAdminUser:', isAdminUser, '| shouldAdmin:', shouldAdmin);
            if (shouldAdmin) {
              document.body.setAttribute('data-admin', 'true');
              console.log('[AuthStore] Set data-admin=true on body');
              redirectAdminIfNeeded(userProfile);
            } else {
              document.body.removeAttribute('data-admin');
            }

          } catch (e: any) {
            console.warn('[AuthStore] Failed to create/update profile:', e?.message || e);
            // Still sign in the user even if Firestore write fails
            // CRITICAL: If user is a super admin, create a minimal profile so admin access works
            const username = getGitHubUsername(u) || null;
            const fallbackProfile = isAdminUser ? {
              uid: u.uid,
              email: u.email || '',
              displayName: u.displayName || '',
              photoURL: u.photoURL || '',
              provider: 'unknown' as const,
              tokens: 0,
              isAdmin: true,
              createdAt: null as any,
              lastLoginAt: null as any,
            } : null;

            $authState.set({
              loading: false,
              isSignedIn: true,
              githubUsername: username,
              isApproved: true,
              profile: fallbackProfile,
              user: u,
              error: e?.message || 'Profile sync failed',
            });
            document.body.setAttribute('data-auth', 'signed-in');

            if (isAdminUser) {
              document.body.setAttribute('data-admin', 'true');
              console.log('[AuthStore] CATCH: Set data-admin=true on body (fallback)');
              redirectAdminIfNeeded(fallbackProfile);
            }
          }
        } else {
          $authState.set({
            loading: false,
            isSignedIn: false,
            githubUsername: null,
            isApproved: false,
            profile: null,
            user: null,
            error: null,
          });
          document.body.removeAttribute('data-auth');
          document.body.removeAttribute('data-admin');
        }
      });
    } catch (e) {
      console.warn('[AuthStore] Firebase not configured:', e);
      $authState.set({ ...$authState.get(), loading: false, error: 'Firebase not configured' });
    }
  })();
}

// ─── Sign In Actions ─────────────────────────────────────

export async function signInWithGoogle() {
  if (!_authRef || !_authModRef || !_googleProviderRef) {
    console.error('[Auth] Firebase not initialized yet');
    return { error: 'Not initialized' };
  }
  try {
    const result = await _authModRef.signInWithPopup(_authRef, _googleProviderRef);
    return { user: result.user };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error('[Auth] Google sign-in failed:', err?.code, msg);
    return { error: msg };
  }
}

export async function signInWithGitHub() {
  if (!_authRef || !_authModRef || !_githubProviderRef) {
    console.error('[Auth] Firebase not initialized yet');
    return { error: 'Not initialized' };
  }
  try {
    const result = await _authModRef.signInWithPopup(_authRef, _githubProviderRef);
    return { user: result.user };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error('[Auth] GitHub sign-in failed:', err?.code, msg);
    return { error: msg, code: err?.code };
  }
}

export async function linkGoogleAccount() {
  if (!_authRef?.currentUser || !_authModRef || !_googleProviderRef) return { error: 'Not initialized' };
  try {
    const result = await _authModRef.linkWithPopup(_authRef.currentUser, _googleProviderRef);
    const { createOrUpdateUserProfile } = await import('../lib/auth');
    await createOrUpdateUserProfile(result.user);
    await refreshProfile();
    return { user: result.user };
  } catch (err: any) {
    const msg = err?.message || String(err);
    return { error: msg, code: err?.code };
  }
}

export async function linkGitHubAccount() {
  if (!_authRef?.currentUser || !_authModRef || !_githubProviderRef) return { error: 'Not initialized' };
  try {
    const result = await _authModRef.linkWithPopup(_authRef.currentUser, _githubProviderRef);
    const { createOrUpdateUserProfile } = await import('../lib/auth');
    await createOrUpdateUserProfile(result.user);
    await refreshProfile();
    return { user: result.user };
  } catch (err: any) {
    const msg = err?.message || String(err);
    return { error: msg, code: err?.code };
  }
}

export async function signOut() {
  if (!_authRef || !_authModRef) return;
  await _authModRef.signOut(_authRef);
}

export async function refreshProfile() {
  const state = $authState.get();
  if (!state.user) return;

  try {
    const { getUserProfile, isSuperAdmin } = await import('../lib/auth');
    const userProfile = await getUserProfile(state.user.uid);

    // Always ensure admin status is set from Firebase Auth email (independent of Firestore)
    if (userProfile && !userProfile.isAdmin && isSuperAdmin(state.user.email)) {
      userProfile.isAdmin = true;
    }

    // If profile fetch failed but user is super admin, create minimal profile
    const finalProfile = userProfile || (isSuperAdmin(state.user.email) ? {
      uid: state.user.uid,
      email: state.user.email || '',
      displayName: state.user.displayName || '',
      photoURL: state.user.photoURL || '',
      provider: 'unknown' as const,
      tokens: 0,
      isAdmin: true,
      createdAt: null as any,
      lastLoginAt: null as any,
    } : null);

    $authState.set({ ...state, profile: finalProfile });

    // Update body attribute
    if (finalProfile?.isAdmin) {
      document.body.setAttribute('data-admin', 'true');
    }
  } catch (e) {
    console.warn('[AuthStore] Failed to refresh profile:', e);
  }
}
