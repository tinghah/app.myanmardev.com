import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { getDB } from '../lib/firebase';
import { type Product } from '../lib/products';
import { refreshProfile } from '../stores/authStore';
import { $authState } from '../stores/authStore';
import { useStore } from '@nanostores/react';
import CheckoutModal from './CheckoutModal';

const API_URL = import.meta.env.PUBLIC_WORKER_API_URL || '';

export default function ProductsGrid() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);
  const [byodHovered, setByodHovered] = useState(false);
  const { isSignedIn } = useStore($authState);

  useEffect(() => {
    let didSetProducts = false;

    // Primary: Firestore real-time listener
    try {
      const db = getDB();
      const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
        const products = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Product[];
        products.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        setProducts(products);
        setLoading(false);
        didSetProducts = true;
      }, (error) => {
        console.error('Products listener error:', error);
        if (!didSetProducts) fetchFromWorker();
      });
      return () => unsubscribe();
    } catch (e) {
      console.error('Firestore init error:', e);
      fetchFromWorker();
    }

    // Fallback: if Firestore doesn't respond in 4s, try Worker API
    const timeout = setTimeout(() => {
      if (!didSetProducts) fetchFromWorker();
    }, 4000);

    async function fetchFromWorker() {
      if (didSetProducts) return;
      didSetProducts = true;
      clearTimeout(timeout);
      try {
        if (!API_URL) { setLoading(false); return; }
        const res = await fetch(`${API_URL}/api/products`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        const items = (data.products || []) as Product[];
        items.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
        setProducts(items);
      } catch (e) {
        console.error('Worker fallback error:', e);
      } finally {
        setLoading(false);
      }
    }

    return () => clearTimeout(timeout);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
        Loading products...
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
        No products available yet.
      </div>
    );
  }

  return (
    <>
      <div className="products-grid">
        {products.map((product) => {
          const isHovered = hoveredId === product.id;
          const isLive = product.status === 'live';

          return (
            <div
              key={product.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: isHovered
                  ? '1px solid rgba(245, 158, 11, 0.3)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: isHovered
                  ? '0 12px 40px rgba(245, 158, 11, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  : '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
                transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
              }}
              onMouseEnter={() => setHoveredId(product.id!)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Gradient overlay at top */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: isLive
                    ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.6), rgba(245, 158, 11, 0.1))'
                    : 'linear-gradient(90deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.03))',
                  borderRadius: '16px 16px 0 0',
                }}
              />

              {/* Status badge */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                <span
                  style={{
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    fontFamily: 'var(--mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    background: isLive ? 'color-mix(in srgb, #22c55e 15%, transparent)' : 'color-mix(in srgb, var(--muted) 15%, transparent)',
                    color: isLive ? '#22c55e' : 'var(--muted)',
                    border: `1px solid ${isLive ? 'color-mix(in srgb, #22c55e 30%, transparent)' : 'var(--border)'}`,
                  }}
                >
                  {isLive ? 'Live' : 'Coming Soon'}
                </span>
              </div>

              {/* Large centered icon */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    borderRadius: '14px',
                    background: isLive
                      ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                      : 'color-mix(in srgb, var(--muted) 10%, transparent)',
                    border: `1px solid ${isLive ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'var(--border)'}`,
                  }}
                >
                  {product.icon}
                </div>
              </div>

              {/* Product info */}
              <h3
                style={{
                  fontFamily: 'var(--display)',
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: 'var(--ink)',
                  margin: '0 0 0.5rem',
                  textAlign: 'center',
                }}
              >
                {product.name}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--body)',
                  fontSize: '0.8125rem',
                  color: 'var(--muted)',
                  margin: '0 0 1rem',
                  lineHeight: 1.5,
                  textAlign: 'center',
                }}
              >
                {product.description}
              </p>

              {/* Features */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem' }}>
                {product.features.map((f, i) => (
                  <li
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.35rem 0',
                      fontFamily: 'var(--body)',
                      fontSize: '0.8125rem',
                      color: isLive ? 'var(--ink)' : 'var(--muted)',
                    }}
                  >
                    <span
                      style={{
                        color: isLive ? '#22c55e' : 'var(--muted)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {isLive ? '✓' : '○'}
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* Duration */}
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  marginBottom: '1rem',
                  fontFamily: 'var(--mono)',
                  fontSize: '0.6875rem',
                  color: 'var(--muted)',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Duration</span>
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{product.duration || 6} months</span>
              </div>

              {/* Price */}
              <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink)' }}>
                  ${product.priceUSD.toFixed(2)}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                  {product.tokenCost} tokens / {product.priceMMK?.toLocaleString()} MMK
                </div>
              </div>

              {/* Spacer to push button to bottom */}
              <div style={{ flex: 1 }} />

              {/* Buy button */}
              {isLive ? (
                <button
                  onClick={() => {
                    if (!isSignedIn) {
                      const lang = window.location.pathname.startsWith('/my') ? 'my' : 'en';
                      window.location.href = `/${lang}/auth/signin`;
                      return;
                    }
                    setCheckoutProduct(product);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '8px',
                    fontFamily: 'var(--mono)',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                    letterSpacing: '0.04em',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(245, 158, 11, 0.5)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.3)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Buy Now
                </button>
              ) : (
                <button
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    background: 'transparent',
                    color: 'var(--muted)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontFamily: 'var(--mono)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'not-allowed',
                    opacity: 0.6,
                  }}
                  disabled
                  title="Coming Soon"
                >
                  Coming Soon
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* BYOD Feature Card */}
      <div
        style={{
          marginTop: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: byodHovered
            ? '1px solid rgba(245, 158, 11, 0.3)'
            : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: byodHovered
            ? '0 12px 40px rgba(245, 158, 11, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            : '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden',
          transform: byodHovered ? 'translateY(-4px)' : 'translateY(0)',
        }}
        onMouseEnter={() => setByodHovered(true)}
        onMouseLeave={() => setByodHovered(false)}
      >
        {/* Gradient overlay at top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.6), rgba(168, 85, 247, 0.4))',
            borderRadius: '16px 16px 0 0',
          }}
        />

        {/* Status badge */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
          <span
            style={{
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              fontSize: '0.625rem',
              fontWeight: 600,
              fontFamily: 'var(--mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              background: 'color-mix(in srgb, #a855f7 15%, transparent)',
              color: '#a855f7',
              border: '1px solid color-mix(in srgb, #a855f7 30%, transparent)',
            }}
          >
            Pro Feature
          </span>
        </div>

        {/* Large centered icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              borderRadius: '14px',
              background: 'color-mix(in srgb, #a855f7 10%, transparent)',
              border: '1px solid color-mix(in srgb, #a855f7 20%, transparent)',
            }}
          >
            🌐
          </div>
        </div>

        {/* Product info */}
        <h3
          style={{
            fontFamily: 'var(--display)',
            fontSize: '1.125rem',
            fontWeight: 700,
            color: 'var(--ink)',
            margin: '0 0 0.5rem',
            textAlign: 'center',
          }}
        >
          BYOD — Bring Your Own Domain
        </h3>
        <p
          style={{
            fontFamily: 'var(--body)',
            fontSize: '0.8125rem',
            color: 'var(--muted)',
            margin: '0 0 1rem',
            lineHeight: 1.5,
            textAlign: 'center',
          }}
        >
          Connect your own domain to our platform. No transfer needed — just Cloudflare API with your domain zone permission.
        </p>

        {/* Features */}
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem' }}>
          {[
            'Connect any domain via Cloudflare API',
            'Auto-add CNAME & TXT records in <30s',
            'Free SSL on all custom domains',
            'Full automation workflows on app.myanmardev.com',
            'Included with Pro package — forever',
          ].map((f, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0',
                fontFamily: 'var(--body)',
                fontSize: '0.8125rem',
                color: 'var(--ink)',
              }}
            >
              <span
                style={{
                  color: '#22c55e',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
              {f}
            </li>
          ))}
        </ul>

        {/* How it works - expandable on hover */}
        <div
          style={{
            padding: '0.75rem',
            borderRadius: '8px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            marginBottom: '1rem',
            maxHeight: byodHovered ? '200px' : '0px',
            opacity: byodHovered ? 1 : 0,
            overflow: 'hidden',
            transition: 'all 0.3s ease',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '0.625rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#a855f7',
              marginBottom: '0.5rem',
            }}
          >
            How It Works
          </div>
          <p
            style={{
              fontFamily: 'var(--body)',
              fontSize: '0.75rem',
              color: 'var(--muted)',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Our app uses the Cloudflare API with your domain zone permission to automatically add CNAME and TXT records for subdomain creation. No need to transfer your domain — just authorize our app and we handle the DNS configuration in under 30 seconds.
          </p>
        </div>

        {/* Button */}
        <div style={{ flex: 1 }} />
        <button
          style={{
            width: '100%',
            padding: '0.8rem',
            background: 'transparent',
            color: '#a855f7',
            border: '1px solid color-mix(in srgb, #a855f7 30%, transparent)',
            borderRadius: '8px',
            fontFamily: 'var(--mono)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'default',
          }}
          disabled
        >
          Pro Feature — Included with Pro Plan
        </button>
      </div>

      {/* Checkout Modal */}
      {checkoutProduct && (
        <CheckoutModal
          product={checkoutProduct}
          isOpen={!!checkoutProduct}
          onClose={() => setCheckoutProduct(null)}
          onSuccess={async () => {
            await refreshProfile();
            setCheckoutProduct(null);
          }}
        />
      )}
    </>
  );
}
