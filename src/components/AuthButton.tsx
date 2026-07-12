import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@nanostores/react';
import { $authState, initAuth, signInWithGoogle, signInWithGitHub, signOut, redirectAdminIfNeeded } from '../stores/authStore';

// ─── Helpers ──────────────────────────────────────────────

function getLangFromPath(): string {
  if (typeof window === 'undefined') return 'en';
  return window.location.pathname.startsWith('/my') ? 'my' : 'en';
}

function getDashboardPath(): string {
  return `/${getLangFromPath()}/dashboard`;
}

// ─── Sign-In Modal (inline, no separate component needed) ─

interface ModalProps {
  onClose: () => void;
  onGoogle: () => void;
  onGitHub: () => void;
  loading: boolean;
  error: string | null;
}

function SignInModal({ onClose, onGoogle, onGitHub, loading, error }: ModalProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(8, 9, 10, 0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '2rem',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px var(--border)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '1rem', right: '1rem',
            background: 'none', border: '1px solid var(--border)',
            color: 'var(--muted)', width: '28px', height: '28px',
            borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          aria-label="Close"
        >✕</button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'rgba(245,158,11,0.1)', marginBottom: '1rem',
            border: '1px solid rgba(245,158,11,0.2)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: '0.6875rem', fontWeight: 700,
            color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: '0.5rem',
          }}>
            myanmardev.com
          </div>
          <h2 style={{
            fontFamily: 'var(--display)', fontSize: '1.375rem', fontWeight: 700,
            color: 'var(--ink)', margin: '0 0 0.4rem', letterSpacing: '-0.02em',
          }}>
            Sign In to Continue
          </h2>
          <p style={{ fontFamily: 'var(--body)', fontSize: '0.8125rem', color: 'var(--muted)', margin: 0 }}>
            One tap to deploy your subdomain
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            marginBottom: '1rem', padding: '0.75rem 1rem',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '8px', color: '#f87171',
            fontFamily: 'var(--mono)', fontSize: '0.75rem', lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Google */}
          <button
            onClick={onGoogle}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.75rem', padding: '0.875rem 1.25rem',
              background: '#fff', color: '#3c4043',
              border: '1px solid #dadce0', borderRadius: '10px',
              fontFamily: 'var(--body)', fontSize: '0.9375rem', fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              width: '100%', transition: 'all 0.15s ease',
              opacity: loading ? 0.6 : 1,
            }}
            onMouseOver={(e) => {
              if (!loading) { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'; e.currentTarget.style.background = '#f8f9fa'; }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = '#fff';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* GitHub */}
          <button
            onClick={onGitHub}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.75rem', padding: '0.875rem 1.25rem',
              background: '#24292f', color: '#fff',
              border: '1px solid #30363d', borderRadius: '10px',
              fontFamily: 'var(--body)', fontSize: '0.9375rem', fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              width: '100%', transition: 'all 0.15s ease',
              opacity: loading ? 0.6 : 1,
            }}
            onMouseOver={(e) => {
              if (!loading) e.currentTarget.style.background = '#2f363d';
            }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#24292f'; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            Continue with GitHub
          </button>
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          margin: '1.25rem 0',
        }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '0.6875rem', color: 'var(--muted)' }}>
            SECURE · INSTANT · FREE TO START
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
        </div>

        <p style={{
          textAlign: 'center', fontFamily: 'var(--mono)', fontSize: '0.625rem',
          color: 'var(--muted)', margin: 0, letterSpacing: '0.04em',
        }}>
          By signing in, you agree to our Terms of Service
        </p>
      </div>
    </div>,
    document.body
  );
}

// ─── Signed-In: User Menu ─────────────────────────────────

interface UserMenuProps {
  profile: any;
  user: any;
  onSignOut: () => void;
}

function UserMenu({ profile, user, onSignOut }: UserMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Dev';
  const initial = displayName[0]?.toUpperCase() || '?';

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: menuOpen ? 'var(--surface-2)' : 'transparent',
          border: '1px solid var(--border)', borderRadius: '8px',
          padding: '0.25rem 0.5rem 0.25rem 0.25rem',
          cursor: 'pointer', transition: 'all 0.15s ease',
        }}
        onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
        onMouseOut={(e) => { if (!menuOpen) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent'; } }}
        aria-label="User menu"
        title={displayName}
      >
        {/* Avatar */}
        {profile?.photoURL || user?.photoURL ? (
          <img
            src={profile?.photoURL || user?.photoURL}
            alt={displayName}
            referrerPolicy="no-referrer"
            style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--border-accent)' }}
          />
        ) : (
          <div style={{
            width: '26px', height: '26px', borderRadius: '50%',
            background: 'rgba(245,158,11,0.15)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent)',
            fontFamily: 'var(--mono)', border: '1.5px solid var(--border-accent)',
          }}>
            {initial}
          </div>
        )}
        {/* Token balance chip - hidden for admins */}
        {profile && !profile.isAdmin && (
          <div style={{
            fontFamily: 'var(--mono)', fontSize: '0.625rem', fontWeight: 700,
            color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '2px',
          }}>
            <span style={{ opacity: 0.7 }}>🪙</span>
            {profile.tokens ?? 0}
          </div>
        )}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 100 }}
            onClick={() => setMenuOpen(false)}
          />
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '12px', boxShadow: '0 16px 48px rgba(0,0,0,0.4), 0 0 0 1px var(--border)',
            minWidth: '200px', overflow: 'hidden', zIndex: 200,
          }}>
            {/* User info */}
            <div style={{
              padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)',
              background: 'var(--surface-2)',
            }}>
              <div style={{
                fontFamily: 'var(--display)', fontSize: '0.875rem', fontWeight: 600,
                color: 'var(--ink)', marginBottom: '0.2rem',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {displayName}
              </div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: '0.625rem', color: 'var(--muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {profile?.email || user?.email}
              </div>
              {profile && !profile.isAdmin && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  marginTop: '0.5rem',
                  fontFamily: 'var(--mono)', fontSize: '0.6875rem',
                  color: 'var(--accent)', fontWeight: 700,
                }}>
                  🪙 {profile.tokens ?? 0} Tokens
                </div>
              )}
            </div>

            {/* Menu Items */}
            {[
              ...(profile?.isAdmin ? [] : [
                { label: 'Dashboard', icon: '⚡', href: getDashboardPath() },
                { label: 'Buy Tokens', icon: '🪙', href: getDashboardPath() + '#buy' },
                { label: 'My Subdomains', icon: '🌐', href: getDashboardPath() + '#subdomains' },
              ]),
              ...(profile?.isAdmin ? [{ label: 'Admin Panel', icon: '⚙️', href: `/${getLangFromPath()}/admin` }] : []),
            ].map(({ label, icon, href }) => (
              <a
                key={label}
                href={href}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.7rem 1rem', textDecoration: 'none',
                  color: 'var(--ink)', fontSize: '0.875rem',
                  fontFamily: 'var(--body)', transition: 'background 0.1s ease',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: '0.9rem' }}>{icon}</span>
                {label}
              </a>
            ))}

            <div style={{ borderTop: '1px solid var(--border)', padding: '0.25rem' }}>
              <button
                onClick={() => { setMenuOpen(false); onSignOut(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  width: '100%', padding: '0.7rem 0.75rem',
                  background: 'transparent', border: 'none', borderRadius: '8px',
                  color: '#f87171', fontSize: '0.875rem', fontFamily: 'var(--body)',
                  cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s ease',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span>🚪</span> Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main AuthButton Component ────────────────────────────

export default function AuthButton() {
  const { loading, isSignedIn, profile, user, error: storeError } = useStore($authState);
  const [showModal, setShowModal] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initAuth();
  }, []);

  // Auto-redirect after sign-in: admins go to /admin, users go to /dashboard
  useEffect(() => {
    if (isSignedIn && typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.includes('/auth/signin')) {
        if (profile?.isAdmin) {
          window.location.href = `/${getLangFromPath()}/admin/users`;
        } else {
          window.location.href = getDashboardPath();
        }
      }
    }
  }, [isSignedIn, profile?.isAdmin]);

  const handleOpen = useCallback(() => {
    setShowModal(true);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    setShowModal(false);
    setError(null);
  }, []);

  const handleGoogle = useCallback(async () => {
    setSigningIn(true);
    setError(null);
    const result = await signInWithGoogle();
    setSigningIn(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setShowModal(false);
    }
  }, []);

  const handleGitHub = useCallback(async () => {
    setSigningIn(true);
    setError(null);
    const result = await signInWithGitHub();
    setSigningIn(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setShowModal(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    // Redirect to home after sign out
    const lang = getLangFromPath();
    window.location.href = `/${lang}/`;
  }, []);

  // Loading state
  if (loading) {
    return (
      <div style={{
        width: '80px', height: '32px', borderRadius: '8px',
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }} />
    );
  }

  // Signed in: show user menu
  if (isSignedIn) {
    return <UserMenu profile={profile} user={user} onSignOut={handleSignOut} />;
  }

  // Signed out: show Sign In / Sign Up buttons
  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          onClick={handleOpen}
          style={{
            padding: '0.45rem 0.9rem',
            background: 'transparent',
            color: 'var(--muted)',
            border: '1px solid var(--border)',
            borderRadius: '7px',
            fontFamily: 'var(--mono)',
            fontSize: '0.6875rem',
            fontWeight: 600,
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.color = 'var(--ink)';
            e.currentTarget.style.borderColor = 'var(--border-accent)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.color = 'var(--muted)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          Sign In
        </button>

        <button
          onClick={handleOpen}
          style={{
            padding: '0.45rem 0.9rem',
            background: 'var(--accent)',
            color: '#000',
            border: '1px solid var(--accent)',
            borderRadius: '7px',
            fontFamily: 'var(--mono)',
            fontSize: '0.6875rem',
            fontWeight: 700,
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 12px var(--glow)',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'var(--accent-light)';
            e.currentTarget.style.boxShadow = '0 4px 20px var(--glow-strong)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'var(--accent)';
            e.currentTarget.style.boxShadow = '0 2px 12px var(--glow)';
          }}
        >
          Deploy Free →
        </button>
      </div>

      {showModal && (
        <SignInModal
          onClose={handleClose}
          onGoogle={handleGoogle}
          onGitHub={handleGitHub}
          loading={signingIn}
          error={error}
        />
      )}
    </>
  );
}
