import React, { useState } from 'react';
import { useStore } from '@nanostores/react';
import { $authState, refreshProfile, linkGoogleAccount, linkGitHubAccount } from '../stores/authStore';
import BuyTokensModal from './BuyTokensModal';
import RedeemCodeModal from './RedeemCodeModal';

export default function ProfileCard() {
  const { isSignedIn, profile, user, refreshProfile } = useStore($authState);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  if (!isSignedIn || !profile) return null;

  const initial = (profile.displayName || profile.email || '?')[0].toUpperCase();

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isGoogleLinked = user?.providerData?.some((p: any) => p.providerId === 'google.com');
  const isGitHubLinked = user?.providerData?.some((p: any) => p.providerId === 'github.com');

  const handleLinkGoogle = async () => {
    setLinkError(null);
    const result = await linkGoogleAccount();
    if (result.error) {
      if (result.code === 'auth/credential-already-in-use') {
        setLinkError('This Google account is already linked to another user.');
      } else {
        setLinkError(result.error);
      }
    }
  };

  const handleLinkGitHub = async () => {
    setLinkError(null);
    const result = await linkGitHubAccount();
    if (result.error) {
      if (result.code === 'auth/credential-already-in-use') {
        setLinkError('This GitHub account is already linked to another user. You cannot link it to this account.');
      } else {
        setLinkError(result.error);
      }
    }
  };

  return (
    <>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '2rem',
      }}>
        {/* Top row: avatar + name + provider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          marginBottom: '1.5rem',
        }}>
          {/* Avatar */}
          {profile.photoURL ? (
            <img
              src={profile.photoURL}
              alt={profile.displayName || 'User'}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--border)',
              }}
            />
          ) : (
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'color-mix(in srgb, var(--accent) 20%, transparent)',
              border: '2px solid color-mix(in srgb, var(--accent) 40%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--display)',
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--accent)',
            }}>
              {initial}
            </div>
          )}

          {/* Name + email */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--display)',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--ink)',
              marginBottom: '0.25rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {profile.displayName || 'Developer'}
            </div>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: '0.8125rem',
              color: 'var(--muted)',
              wordBreak: 'break-all',
            }}>
              {profile.email || (profile.provider === 'github' ? 'GitHub Account' : 'N/A')}
            </div>
          </div>

          {/* Auth provider badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            background: 'var(--border)',
            borderRadius: '6px',
            flexShrink: 0,
          }}>
            {profile.provider === 'google' || profile.provider === 'google, github' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '0.6875rem',
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>Google</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--muted)">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '0.6875rem',
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>GitHub</span>
              </>
            )}
          </div>
        </div>

        {/* Token balance — prominent */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1.25rem',
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
          borderRadius: '10px',
          marginBottom: '1.25rem',
        }}>
          <span style={{ fontSize: '1.75rem' }}>🪙</span>
          <div>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'var(--accent)',
              lineHeight: 1,
            }}>
              {profile.tokens}
            </div>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: '0.6875rem',
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginTop: '0.2rem',
            }}>
              Tokens Available
            </div>
          </div>
        </div>

        {/* Member since */}
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: '0.75rem',
          color: 'var(--muted)',
          marginBottom: '1.5rem',
        }}>
          Member since {formatDate(profile.createdAt)}
        </div>

        {/* Account Linking */}
        <div style={{
          background: 'var(--base)',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: '0.6875rem',
            color: 'var(--ink)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 700,
            marginBottom: '0.75rem'
          }}>
            Linked Accounts
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>Google</span>
              {isGoogleLinked ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>Linked ✅</span>
              ) : (
                <button onClick={handleLinkGoogle} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', color: 'var(--ink)' }}>Link Google</button>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>GitHub</span>
              {isGitHubLinked ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>Linked ✅</span>
              ) : (
                <button onClick={handleLinkGitHub} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', color: 'var(--ink)' }}>Link GitHub</button>
              )}
            </div>
          </div>
          {linkError && (
            <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'color-mix(in srgb, #E8A33D 10%, transparent)', border: '1px solid #E8A33D', borderRadius: '4px', color: '#E8A33D', fontSize: '0.75rem' }}>
              {linkError}
            </div>
          )}
        </div>

        {/* Quick action buttons */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setShowBuyModal(true)}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: 'var(--accent)',
              color: 'var(--base)',
              border: 'none',
              borderRadius: '6px',
              fontFamily: 'var(--mono)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.opacity = '0.9';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Buy Tokens
          </button>
          <button
            onClick={() => setShowRedeemModal(true)}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: 'transparent',
              color: 'var(--ink)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontFamily: 'var(--mono)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--ink)';
            }}
          >
            Redeem Code
          </button>
        </div>
      </div>

      <BuyTokensModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
        onSuccess={refreshProfile}
      />
      <RedeemCodeModal
        isOpen={showRedeemModal}
        onClose={() => setShowRedeemModal(false)}
        onSuccess={refreshProfile}
      />
    </>
  );
}
