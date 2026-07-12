import React, { useEffect, useState } from 'react';
import { getAllCodes, createRedeemCode, disableCode } from '../../lib/admin';
import type { RedeemCode } from '../../lib/redeem';
import { $authState } from '../../stores/authStore';
import { useStore } from '@nanostores/react';

export default function CodesManager() {
  const [codes, setCodes] = useState<RedeemCode[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useStore($authState);

  // Form State
  const [codeStr, setCodeStr] = useState('');
  const [tokens, setTokens] = useState(10);
  const [maxUses, setMaxUses] = useState(100);
  const [validityDays, setValidityDays] = useState(10); // 0 means no expiration
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const data = await getAllCodes();
      setCodes(data);
    } catch (e) {
      console.error("Failed to load codes", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError(null);
    setIsCreating(true);

    let finalCode = codeStr.trim().toUpperCase();
    if (!finalCode) {
      // Generate random code MYAN-XXXX-XXXX
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const randomSegment = () => Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      finalCode = `MYAN-${randomSegment()}-${randomSegment()}`;
    }

    try {
      await createRedeemCode(finalCode, tokens, maxUses, validityDays, profile.email);
      setCodeStr('');
      setTokens(10);
      setMaxUses(100);
      setValidityDays(10);
      await fetchCodes();
    } catch (err: any) {
      setError(err.message || 'Failed to create code');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDisable = async (code: string) => {
    if (confirm(`Are you sure you want to disable ${code}?`)) {
      try {
        await disableCode(code);
        await fetchCodes();
      } catch (e) {
        console.error("Failed to disable code", e);
      }
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Never';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const isExpired = (code: RedeemCode) => {
    if (!code.expiresAt) return false;
    return code.expiresAt.toMillis() < Date.now();
  };

  const isExhausted = (code: RedeemCode) => {
    return code.currentUses >= code.maxUses;
  };

  return (
    <div>
      {/* Create Code Form */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--ink)' }}>Create Redeem Code</h2>
        {error && <div style={{ color: '#E8A33D', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
        
        <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Code (leave empty for random)</label>
            <input 
              type="text" 
              value={codeStr} 
              onChange={e => setCodeStr(e.target.value)}
              placeholder="e.g. WELCOME2026"
              style={{ width: '100%', padding: '0.5rem', background: 'var(--base)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--ink)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Tokens</label>
            <input 
              type="number" 
              min="1"
              value={tokens} 
              onChange={e => setTokens(Number(e.target.value))}
              style={{ width: '100%', padding: '0.5rem', background: 'var(--base)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--ink)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Max Uses</label>
            <input 
              type="number" 
              min="1"
              value={maxUses} 
              onChange={e => setMaxUses(Number(e.target.value))}
              style={{ width: '100%', padding: '0.5rem', background: 'var(--base)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--ink)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Validity (Days, 0 for unlimited)</label>
            <input 
              type="number" 
              min="0"
              value={validityDays} 
              onChange={e => setValidityDays(Number(e.target.value))}
              style={{ width: '100%', padding: '0.5rem', background: 'var(--base)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--ink)' }}
            />
          </div>
          <div>
            <button 
              type="submit" 
              disabled={isCreating}
              style={{
                width: '100%',
                padding: '0.6rem',
                background: 'var(--accent)',
                color: 'var(--base)',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 600,
                cursor: isCreating ? 'not-allowed' : 'pointer',
                opacity: isCreating ? 0.7 : 1
              }}
            >
              {isCreating ? 'Creating...' : 'Create Code'}
            </button>
          </div>
        </form>
      </div>

      {/* Codes Table */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading codes...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Code</th>
                  <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Tokens</th>
                  <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Usage</th>
                  <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Expires</th>
                  <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {codes.map(code => {
                  const expired = isExpired(code);
                  const exhausted = isExhausted(code);
                  const active = !expired && !exhausted;

                  return (
                    <tr key={code.code} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', color: 'var(--ink)', fontWeight: 600, fontFamily: 'var(--mono)' }}>
                        {code.code}
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--mono)' }}>
                        {code.tokenAmount}
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--ink-2)', fontSize: '0.875rem' }}>
                        {code.currentUses} / {code.maxUses}
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>By {code.usedBy.length} users</div>
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.875rem' }}>
                        {formatDate(code.expiresAt)}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: active ? 'color-mix(in srgb, #34A853 10%, transparent)' : 'color-mix(in srgb, var(--muted) 10%, transparent)',
                          color: active ? '#34A853' : 'var(--muted)'
                        }}>
                          {active ? 'Active' : (exhausted ? 'Exhausted' : 'Expired')}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {active && (
                          <button 
                            onClick={() => handleDisable(code.code)}
                            style={{
                              background: 'transparent',
                              border: '1px solid #EA4335',
                              color: '#EA4335',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            Disable
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {codes.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                      No redeem codes found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
