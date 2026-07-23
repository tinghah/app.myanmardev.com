import React, { useState, useCallback, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { $authState, initAuth, signOut } from '../stores/authStore';

// ─── Helpers ──────────────────────────────────────────────

const SUPER_ADMIN_EMAILS = [
  'myanmardevadmin@gmail.com',
  'ting.pouchen@gmail.com'
];

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

function getLangFromPath(): string {
  if (typeof window === 'undefined') return 'en';
  return window.location.pathname.startsWith('/my') ? 'my' : 'en';
}

function getDashboardPath(): string {
  return `/${getLangFromPath()}/dashboard`;
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
  const isAdmin = profile?.isAdmin || isAdminEmail(user?.email);

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
        {profile && !isAdmin && (
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
              {profile && !isAdmin && (
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
              ...(isAdmin ? [] : [
                { label: 'Dashboard', icon: '⚡', href: getDashboardPath() },
                { label: 'Buy Tokens', icon: '🪙', href: getDashboardPath() + '#buy' },
                { label: 'My Subdomains', icon: '🌐', href: getDashboardPath() + '#subdomains' },
              ]),
              ...(isAdmin ? [{ label: 'Admin Panel', icon: '⚙️', href: `/${getLangFromPath()}/admin` }] : []),
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

  useEffect(() => {
    initAuth();
  }, []);

  // Auto-redirect after sign-in: admins go to /admin, users go to /dashboard
  useEffect(() => {
    if (isSignedIn && typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.includes('/auth/signin')) {
        if (profile?.isAdmin || isAdminEmail(user?.email)) {
          window.location.href = `/${getLangFromPath()}/admin/users`;
        } else {
          window.location.href = getDashboardPath();
        }
      }
    }
  }, [isSignedIn, profile?.isAdmin, user?.email]);

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

  // Signed out: show Sign In / Sign Up links
  const signinPath = `/${getLangFromPath()}/auth/signin`;

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <a
        href={signinPath}
        style={{
          padding: '0.45rem 0.9rem',
          background: 'transparent',
          color: 'var(--muted)',
          border: '1px solid var(--border)',
          borderRadius: '7px',
          fontFamily: 'var(--mono)',
          fontSize: '0.6875rem',
          fontWeight: 600,
          textDecoration: 'none',
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
      </a>

      <a
        href={signinPath}
        style={{
          padding: '0.45rem 0.9rem',
          background: 'var(--accent)',
          color: '#000',
          border: '1px solid var(--accent)',
          borderRadius: '7px',
          fontFamily: 'var(--mono)',
          fontSize: '0.6875rem',
          fontWeight: 700,
          textDecoration: 'none',
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
      </a>
    </div>
  );
}
