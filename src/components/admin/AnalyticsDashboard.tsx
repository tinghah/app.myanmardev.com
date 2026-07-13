import React, { useState, useEffect } from 'react';
import { getAnalytics, type AnalyticsData } from '../../lib/analytics';
import { useStore } from '@nanostores/react';
import { $authState } from '../../stores/authStore';

function StatCard({ label, value, sub, icon, color }: { label: string; value: string | number; sub?: string; icon: string; color: string }) {
  return (
    <div style={{
      padding: '1.25rem',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '1rem',
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.25rem',
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--ink)',
          lineHeight: 1.1,
        }}>
          {value}
        </div>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: '0.6875rem',
          fontWeight: 600,
          color: 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginTop: '0.25rem',
        }}>
          {label}
        </div>
        {sub && (
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: '0.6875rem',
            color: 'var(--muted)',
            marginTop: '0.15rem',
          }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniTable({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '0.875rem 1.25rem',
        borderBottom: '1px solid var(--border)',
        fontFamily: 'var(--mono)',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'var(--muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {title}
      </div>
      <div style={{ maxHeight: '320px', overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { profile } = useStore($authState);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.isAdmin) return;
    getAnalytics()
      .then(setData)
      .catch((e) => setError(e.message || 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [profile]);

  if (!profile?.isAdmin) {
    return <div style={{ padding: '2rem', color: 'var(--muted)', textAlign: 'center' }}>Admin access required.</div>;
  }

  if (loading) {
    return <div style={{ padding: '2rem', color: 'var(--muted)', textAlign: 'center', fontFamily: 'var(--mono)' }}>Loading analytics...</div>;
  }

  if (error) {
    return <div style={{ padding: '2rem', color: '#E8A33D', textAlign: 'center', fontFamily: 'var(--mono)' }}>{error}</div>;
  }

  if (!data) return null;

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      {/* Key Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <StatCard icon="👥" label="Total Users" value={data.totalUsers} sub={`${data.usersToday} today · ${data.usersThisWeek} this week`} color="var(--accent)" />
        <StatCard icon="🪙" label="Tokens in Circulation" value={data.totalTokensInCirculation} sub={`${data.totalTokensRedeemed} redeemed · ${data.totalTokensSpent} spent`} color="#22c55e" />
        <StatCard icon="📦" label="Total Orders" value={data.totalOrders} sub={`${data.pendingOrders} pending · ${data.completedOrders} completed`} color="#4285F4" />
        <StatCard icon="💰" label="Revenue" value={`$${data.totalRevenue.toFixed(2)}`} sub="from approved token purchases" color="#FBBC05" />
        <StatCard icon="🎟️" label="Redeem Codes" value={data.totalCodes} sub={`${data.activeCodes} active · ${data.totalRedemptions} total redemptions`} color="#EA4335" />
      </div>

      {/* Recent Activity */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.5rem',
        marginBottom: '2rem',
      }}>
        <MiniTable title="Recent Orders">
          {data.recentOrders.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>No orders yet</div>
          ) : (
            data.recentOrders.map((order, i) => (
              <div key={order.id || i} style={{
                padding: '0.75rem 1.25rem',
                borderBottom: i < data.recentOrders.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '0.8125rem', color: 'var(--ink)', fontWeight: 600 }}>
                    {order.type === 'token_purchase' ? `Token Purchase` : `${order.type}`}
                    {order.type === 'subdomain' && 'details' in order && order.details?.subdomain ? ` — ${order.details.subdomain}` : ''}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '0.6875rem', color: 'var(--muted)' }}>
                    {formatDate(order.createdAt)}
                  </div>
                </div>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  fontFamily: 'var(--mono)',
                  background: order.status === 'completed' || order.status === 'approved'
                    ? 'color-mix(in srgb, #22c55e 12%, transparent)'
                    : order.status === 'pending'
                      ? 'color-mix(in srgb, #E8A33D 12%, transparent)'
                      : 'color-mix(in srgb, #EA4335 12%, transparent)',
                  color: order.status === 'completed' || order.status === 'approved'
                    ? '#22c55e'
                    : order.status === 'pending'
                      ? '#E8A33D'
                      : '#EA4335',
                }}>
                  {order.status}
                </span>
              </div>
            ))
          )}
        </MiniTable>

        <MiniTable title="Recent Users">
          {data.recentUsers.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>No users yet</div>
          ) : (
            data.recentUsers.map((user, i) => (
              <div key={user.uid} style={{
                padding: '0.75rem 1.25rem',
                borderBottom: i < data.recentUsers.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                ) : (
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--muted)',
                  }}>
                    {user.email?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '0.8125rem', color: 'var(--ink)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.displayName || user.email || 'Unknown'}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '0.6875rem', color: 'var(--muted)' }}>
                    {user.tokens} tokens · {formatDate(user.lastLoginAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </MiniTable>
      </div>
    </div>
  );
}
