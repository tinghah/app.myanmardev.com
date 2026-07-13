import React, { useEffect, useState } from 'react';
import { getAllUsers, disableUser, enableUser, deleteUser, addUserTokens } from '../../lib/admin';
import type { UserProfile } from '../../lib/auth';

export default function UsersTable() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [topupModal, setTopupModal] = useState<string | null>(null);
  const [topupAmount, setTopupAmount] = useState(10);

  const fetchUsers = async () => {
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (e) {
      console.error("Failed to load users", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDisable = async (uid: string) => {
    if (!confirm('Disable this user? They will not be able to sign in.')) return;
    setActionLoading(uid);
    try {
      await disableUser(uid);
      await fetchUsers();
    } catch (e: any) {
      alert('Failed: ' + (e.message || e));
    } finally {
      setActionLoading(null);
    }
  };

  const handleEnable = async (uid: string) => {
    setActionLoading(uid);
    try {
      await enableUser(uid);
      await fetchUsers();
    } catch (e: any) {
      alert('Failed: ' + (e.message || e));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (uid: string, email: string) => {
    if (!confirm(`DELETE user ${email}? This cannot be undone!`)) return;
    if (!confirm('Are you REALLY sure? This permanently deletes their data.')) return;
    setActionLoading(uid);
    try {
      await deleteUser(uid);
      await fetchUsers();
    } catch (e: any) {
      alert('Failed: ' + (e.message || e));
    } finally {
      setActionLoading(null);
    }
  };

  const handleTopup = async (uid: string) => {
    if (topupAmount < 1) return;
    setActionLoading(uid);
    try {
      await addUserTokens(uid, topupAmount);
      setTopupModal(null);
      setTopupAmount(10);
      await fetchUsers();
    } catch (e: any) {
      alert('Failed: ' + (e.message || e));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--muted)' }}>Loading users...</div>;
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>User</th>
                <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Provider</th>
                <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Tokens</th>
                <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Created</th>
                <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Last Login</th>
                <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const isDisabled = user.disabled === true;
                return (
                  <tr key={user.uid} style={{ borderBottom: '1px solid var(--border)', opacity: actionLoading === user.uid ? 0.5 : 1 }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                        ) : (
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {user.email?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--ink)' }}>
                            {user.displayName || 'No Name'}
                            {user.isAdmin && <span style={{ fontSize: '0.75rem', color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.5rem' }}>Admin</span>}
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{user.email || user.githubUsername || 'No Email'}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.2rem', fontFamily: 'var(--mono)' }}>{user.uid}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--ink-2)', fontSize: '0.875rem' }}>
                      {user.provider}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--mono)' }}>
                          {user.tokens}
                        </span>
                        {!user.isAdmin && (
                          <button
                            onClick={() => { setTopupModal(user.uid); setTopupAmount(10); }}
                            style={{ padding: '2px 6px', background: 'color-mix(in srgb, #22c55e 12%, transparent)', color: '#22c55e', border: '1px solid color-mix(in srgb, #22c55e 30%, transparent)', borderRadius: '4px', fontSize: '0.625rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--mono)' }}
                          >
                            + Topup
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                        background: isDisabled ? 'color-mix(in srgb, #EA4335 12%, transparent)' : 'color-mix(in srgb, #22c55e 12%, transparent)',
                        color: isDisabled ? '#EA4335' : '#22c55e',
                      }}>
                        {isDisabled ? 'Disabled' : 'Active'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.875rem' }}>
                      {formatDate(user.createdAt)}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.875rem' }}>
                      {formatDate(user.lastLoginAt)}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {!user.isAdmin && (
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {isDisabled ? (
                            <button
                              onClick={() => handleEnable(user.uid)}
                              disabled={actionLoading === user.uid}
                              style={{ padding: '3px 8px', background: 'color-mix(in srgb, #22c55e 12%, transparent)', color: '#22c55e', border: '1px solid #22c55e', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--mono)' }}
                            >
                              Enable
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDisable(user.uid)}
                              disabled={actionLoading === user.uid}
                              style={{ padding: '3px 8px', background: 'transparent', color: '#E8A33D', border: '1px solid #E8A33D', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--mono)' }}
                            >
                              Disable
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(user.uid, user.email || '')}
                            disabled={actionLoading === user.uid}
                            style={{ padding: '3px 8px', background: 'transparent', color: '#EA4335', border: '1px solid #EA4335', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--mono)' }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Token Topup Modal */}
      {topupModal && typeof document !== 'undefined' && (() => {
        const targetUser = users.find(u => u.uid === topupModal);
        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,9,10,0.5)', backdropFilter: 'blur(8px)' }}
            onClick={() => setTopupModal(null)}
          >
            <div
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '2rem', maxWidth: '400px', width: '90%' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontFamily: 'var(--display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--ink)', margin: '0 0 0.5rem' }}>
                Topup Tokens
              </h3>
              <p style={{ fontFamily: 'var(--body)', fontSize: '0.8125rem', color: 'var(--muted)', margin: '0 0 1rem' }}>
                Add tokens to {targetUser?.email || 'user'}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {[5, 10, 25, 50, 100].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setTopupAmount(amt)}
                    style={{
                      padding: '0.4rem 0.8rem', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      background: topupAmount === amt ? 'var(--accent)' : 'var(--surface-2)',
                      color: topupAmount === amt ? 'var(--base)' : 'var(--ink)',
                      border: `1px solid ${topupAmount === amt ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    {amt}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.625rem' }}>
                <button
                  onClick={() => setTopupModal(null)}
                  style={{ flex: 1, padding: '0.6rem', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleTopup(topupModal)}
                  disabled={actionLoading === topupModal || topupAmount < 1}
                  style={{ flex: 2, padding: '0.6rem', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 600, cursor: actionLoading === topupModal ? 'not-allowed' : 'pointer', opacity: actionLoading === topupModal ? 0.7 : 1 }}
                >
                  {actionLoading === topupModal ? 'Adding...' : `Add ${topupAmount} Tokens`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
