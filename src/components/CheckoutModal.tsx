import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@nanostores/react';
import { $authState, refreshProfile } from '../stores/authStore';
import { type Product } from '../lib/products';
import { createProductOrder } from '../lib/orders';
import { checkSubdomain, createSubdomain } from '../lib/api';
import { getProduct } from '../lib/products';
import BuyTokensModal from './BuyTokensModal';

interface Props {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DOMAINS = ['myanmardev.com', 'myanmar.dpdns.org', 'tinghah.online'];

type Step = 'details' | 'confirm' | 'processing' | 'success' | 'error';

export default function CheckoutModal({ product, isOpen, onClose, onSuccess }: Props) {
  const { user, profile } = useStore($authState);
  const [step, setStep] = useState<Step>('details');
  const [domain, setDomain] = useState(DOMAINS[0]);
  const [subdomain, setSubdomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showBuyTokensModal, setShowBuyTokensModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const duration = product.duration || 6;
  const hasEnoughTokens = (profile?.tokens || 0) >= product.tokenCost;

  // Focus trap and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement?.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement?.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Focus the modal on open
    setTimeout(() => modalRef.current?.focus(), 50);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [isOpen, onClose]);

  const handleConfirm = useCallback(async () => {
    if (!user || !profile) return;

    setStep('processing');
    setError(null);

    try {
      if (product.category === 'dns') {
        // DNS product flow - use SubdomainBuilder API
        const trimmedSubdomain = subdomain.trim().toLowerCase();
        if (!trimmedSubdomain) {
          setError('Please enter a subdomain name.');
          setStep('details');
          return;
        }

        // Check availability
        const checkResult = await checkSubdomain(trimmedSubdomain, domain);
        if (!checkResult.available) {
          setError(`${trimmedSubdomain}.${domain} is already taken.`);
          setStep('details');
          return;
        }

        // Create subdomain (Worker deducts tokens server-side)
        const result = await createSubdomain({
          subdomain: trimmedSubdomain,
          domain,
          platform: 'github',
          sourceUrl: '',
        });

        // Record order
        await createProductOrder(
          user.uid,
          profile.email,
          'subdomain',
          product.tokenCost,
          {
            subdomain: trimmedSubdomain,
            domain,
            target: result.record.content,
            cloudflareRecordId: result.message.replace('Created DNS record ', ''),
            productId: product.id,
          }
        );
      } else {
        // Generic product order
        await createProductOrder(
          user.uid,
          profile.email,
          product.category as 'subdomain' | 'website' | 'portfolio',
          product.tokenCost,
          {
            productId: product.id,
            productName: product.name,
            duration,
          }
        );
      }

      await refreshProfile();
      setStep('success');
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Checkout failed. Please try again.');
      setStep('error');
    }
  }, [user, profile, product, domain, subdomain, duration, onSuccess]);

  const handleClose = useCallback(() => {
    setStep('details');
    setSubdomain('');
    setError(null);
    setShowBuyTokensModal(false);
    onClose();
  }, [onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const glassStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(8, 9, 10, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={handleClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        style={{
          ...glassStyle,
          padding: '2rem',
          maxWidth: '480px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          position: 'relative',
          outline: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '0.75rem',
            right: '0.75rem',
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            fontSize: '1rem',
            cursor: 'pointer',
            padding: '0.25rem',
            lineHeight: 1,
            fontFamily: 'var(--mono)',
          }}
        >
          X
        </button>

        {/* Success state */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>Done!</div>
            <h3
              style={{
                fontFamily: 'var(--display)',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#22c55e',
                margin: '0 0 0.5rem',
              }}
            >
              Purchase Complete!
            </h3>
            <p
              style={{
                fontFamily: 'var(--body)',
                fontSize: '0.875rem',
                color: 'var(--muted)',
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              Your {product.name} has been activated for {duration} months.
            </p>
          </div>
        )}

        {/* Error state */}
        {step === 'error' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>!</div>
            <h3
              style={{
                fontFamily: 'var(--display)',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#E8A33D',
                margin: '0 0 0.5rem',
              }}
            >
              Checkout Failed
            </h3>
            <p
              style={{
                fontFamily: 'var(--body)',
                fontSize: '0.875rem',
                color: 'var(--muted)',
                margin: '0 0 1.5rem',
                lineHeight: 1.6,
              }}
            >
              {error}
            </p>
            <button
              onClick={() => setStep('details')}
              style={{
                padding: '0.7rem 1.5rem',
                background: 'var(--accent)',
                color: 'var(--base)',
                border: 'none',
                borderRadius: '6px',
                fontFamily: 'var(--mono)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Processing state */}
        {step === 'processing' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <svg
              style={{ width: '48px', height: '48px', animation: 'tgSpin 1s linear infinite', marginBottom: '1rem' }}
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" opacity="0.75" />
            </svg>
            <h3
              style={{
                fontFamily: 'var(--display)',
                fontSize: '1.125rem',
                fontWeight: 700,
                color: 'var(--ink)',
                margin: '0 0 0.5rem',
              }}
            >
              Processing...
            </h3>
            <p
              style={{
                fontFamily: 'var(--body)',
                fontSize: '0.8125rem',
                color: 'var(--muted)',
                margin: 0,
              }}
            >
              {product.category === 'dns' ? 'Creating your subdomain...' : 'Activating your product...'}
            </p>
          </div>
        )}

        {/* Details / Confirm step */}
        {(step === 'details' || step === 'confirm') && (
          <>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{product.icon}</div>
              <h2
                style={{
                  fontFamily: 'var(--display)',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--ink)',
                  margin: '0 0 0.25rem',
                }}
              >
                {product.name}
              </h2>
              <p
                style={{
                  fontFamily: 'var(--body)',
                  fontSize: '0.8125rem',
                  color: 'var(--muted)',
                  margin: 0,
                }}
              >
                {product.description}
              </p>
            </div>

            {/* Product details card */}
            <div
              style={{
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--muted)' }}>Price</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--ink)' }}>
                  ${product.priceUSD.toFixed(2)} USD
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--muted)' }}>Token Cost</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent)' }}>
                  {product.tokenCost} tokens
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--muted)' }}>MMK Price</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--ink)' }}>
                  {product.priceMMK?.toLocaleString()} MMK
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--muted)' }}>Duration</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--ink)' }}>
                  {duration} months
                </span>
              </div>
            </div>

            {/* Domain selector for DNS products */}
            {product.category === 'dns' && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'var(--mono)',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: '0.5rem',
                  }}
                >
                  Select Domain
                </label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.8rem',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                    fontFamily: 'var(--mono)',
                    fontSize: '0.875rem',
                  }}
                >
                  {DOMAINS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <label
                  style={{
                    display: 'block',
                    fontFamily: 'var(--mono)',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginTop: '0.75rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  Subdomain Name
                </label>
                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                  <input
                    type="text"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="yourname"
                    style={{
                      flex: 1,
                      padding: '0.7rem 0.8rem',
                      border: '1px solid var(--border)',
                      borderRight: 'none',
                      borderRadius: '6px 0 0 6px',
                      background: 'var(--surface)',
                      color: 'var(--ink)',
                      fontFamily: 'var(--mono)',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0 0.75rem',
                      background: 'var(--surface)',
                      color: 'var(--muted)',
                      fontFamily: 'var(--mono)',
                      fontSize: '0.8125rem',
                      border: '1px solid var(--border)',
                      borderLeft: 0,
                      borderRadius: '0 6px 6px 0',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    .{domain}
                  </span>
                </div>
                {subdomain && (
                  <div
                    style={{
                      marginTop: '0.5rem',
                      fontFamily: 'var(--mono)',
                      fontSize: '0.6875rem',
                      color: 'var(--muted)',
                    }}
                  >
                    Preview: <span style={{ color: 'var(--accent)' }}>{subdomain}.{domain}</span>
                  </div>
                )}
              </div>
            )}

            {/* Token balance */}
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: `1px solid ${hasEnoughTokens ? 'color-mix(in srgb, #22c55e 30%, transparent)' : 'color-mix(in srgb, #E8A33D 30%, transparent)'}`,
                background: hasEnoughTokens ? 'color-mix(in srgb, #22c55e 8%, transparent)' : 'color-mix(in srgb, #E8A33D 8%, transparent)',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--muted)' }}>Your Balance</span>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: hasEnoughTokens ? '#22c55e' : '#E8A33D',
                }}
              >
                {profile?.tokens || 0} tokens
              </span>
            </div>

            {/* Error message */}
            {error && (
              <div
                style={{
                  padding: '0.75rem',
                  background: 'color-mix(in srgb, #E8A33D 10%, transparent)',
                  border: '1px solid #E8A33D',
                  borderRadius: '6px',
                  color: '#E8A33D',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--mono)',
                  marginBottom: '1rem',
                }}
              >
                {error}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button
                onClick={handleClose}
                style={{
                  flex: 1,
                  padding: '0.7rem',
                  background: 'transparent',
                  color: 'var(--ink)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontFamily: 'var(--mono)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              {hasEnoughTokens ? (
                <button
                  onClick={handleConfirm}
                  disabled={product.category === 'dns' && !subdomain.trim()}
                  style={{
                    flex: 2,
                    padding: '0.7rem',
                    background: product.category === 'dns' && !subdomain.trim() ? 'var(--surface)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                    color: product.category === 'dns' && !subdomain.trim() ? 'var(--muted)' : '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontFamily: 'var(--mono)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: product.category === 'dns' && !subdomain.trim() ? 'not-allowed' : 'pointer',
                    boxShadow: product.category === 'dns' && !subdomain.trim() ? 'none' : '0 2px 8px rgba(34, 197, 94, 0.3)',
                  }}
                >
                  Pay with {product.tokenCost} Tokens
                </button>
              ) : (
                <button
                  onClick={() => setShowBuyTokensModal(true)}
                  style={{
                    flex: 2,
                    padding: '0.7rem',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '6px',
                    fontFamily: 'var(--mono)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                  }}
                >
                  Buy Tokens First
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Buy Tokens Modal */}
      <BuyTokensModal
        isOpen={showBuyTokensModal}
        onClose={() => setShowBuyTokensModal(false)}
        onSuccess={async () => {
          await refreshProfile();
          setShowBuyTokensModal(false);
        }}
      />
    </div>,
    document.body
  );
}
