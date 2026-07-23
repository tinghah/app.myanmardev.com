import React, { useEffect, useState } from 'react';
import { getAllUsers, disableUser, enableUser, deleteUser, addUserTokens, removeUserTokens, setUserRole } from '../../lib/admin';
import type { UserProfile } from '../../lib/auth';

export default function UsersTable() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [topupModal, setTopupModal] = useState<{ uid: string; email: string } | null>(null);
  const [topupAmount, setTopupAmount] = useState(10);
  const [deductModal, setDeductModal] = useState<{ uid: string; email: string; currentTokens: number } | null>(null);
  const [deductAmount, setDeductAmount] = useState(1);

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

  useEffect(() => { fetchUsers(); }, []);

  const handleDisable = async (uid: string) => {
    if (!confirm('Disable this user? They will not be able to sign in.')) return;
    setActionLoading(uid);
    try {
      await disableUser(uid);
      await fetchUsers();
    } catch (e: any) { alert('Failed: ' + (e.message || e)); }
    finally { setActionLoading(null); }
  };

  const handleEnable = async (uid: string) => {
    setActionLoading(uid);
    try {
      await enableUser(uid);
      await fetchUsers();
    } catch (e: any) { alert('Failed: ' + (e.message || e)); }
    finally { setActionLoading(null); }
  };

  const handleDelete = async (uid: string, email: string) => {
    if (!confirm(`DELETE user ${email}? This cannot be undone!`)) return;
    if (!confirm('Are you REALLY sure? This permanently deletes their data.')) return;
    setActionLoading(uid);
    try {
      await deleteUser(uid);
      await fetchUsers();
    } catch (e: any) { alert('Failed: ' + (e.message || e)); }
    finally { setActionLoading(null); }
  };

  const handleRoleToggle = async (uid: string, currentIsAdmin: boolean) => {
    const action = currentIsAdmin ? 'Demote to User' : 'Promote to Admin';
    if (!confirm(`${action}?`)) return;
    setActionLoading(uid);
    try {
      await setUserRole(uid, !currentIsAdmin);
      await fetchUsers();
    } catch (e: any) { alert('Failed: ' + (e.message || e)); }
    finally { setActionLoading(null); }
  };

  const handleTopup = async (uid: string) => {
    if (topupAmount < 1) return;
    setActionLoading(uid);
    try {
      await addUserTokens(uid, topupAmount);
      setTopupModal(null);
      setTopupAmount(10);
      await fetchUsers();
    } catch (e: any) { alert('Failed: ' + (e.message || e)); }
    finally { setActionLoading(null); }
  };

  const handleDeduct = async (uid: string) => {
    if (deductAmount < 1) return;
    setActionLoading(uid);
    try {
      await removeUserTokens(uid, deductAmount);
      setDeductModal(null);
      setDeductAmount(1);
      await fetchUsers();
    } catch (e: any) { alert('Failed: ' + (e.message || e)); }
    finally { setActionLoading(null); }
  };

  if (loading) return <div style={{ color: 'var(--muted)', padding: '1rem' }}>Loading users...</div>;

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Check if user is a hardcoded super admin (cannot be demoted)
  const SUPER_ADMINS = ['myanmardevadmin@gmail.com', 'ting.pouchen@gmail.com'];
  const isSuperAdmin = (email: string) => SUPER_ADMINS.includes(email?.toLowerCase());

  return (
    <div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['User', 'Provider', 'Tokens', 'Status', 'Role', 'Created', 'Last Login', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', color: 'var(--muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const disabled = (user as any).disabled === true;
                const userIsSuperAdmin = isSuperAdmin(user.email);
                return (
                  <tr key={user.uid} style={{ borderBottom: '1px solid var(--border)', opacity: actionLoading === user.uid ? 0.5 : 1 }}>
                    {/* USER */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                        ) : (
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--muted)' }}>
                            {user.email?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '0.875rem' }}>{user.displayName || 'No Name'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{user.email}</div>
                          {user.githubUsername && (
                            <div style={{ fontSize: '0.6875rem', color: 'var(--accent)', fontFamily: 'var(--mono)' }}>@{user.githubUsername}</div>
                          )}
                          <div style={{ fontSize: '0.625rem', color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: '0.15rem' }}>{user.uid.slice(0, 20)}...</div>
                        </div>
                      </div>
                    </td>
                    {/* PROVIDER */}
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--ink-2)', textTransform: 'capitalize' }}>
                      {user.provider}
                    </td>
                    {/* TOKENS */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--accent)', fontSize: '0.875rem' }}>{user.tokens}</span>
                    </td>
                    {/* STATUS */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'var(--mono)',
                        background: disabled ? 'color-mix(in srgb, #EA4335 10%, transparent)' : 'color-mix(in srgb, #22c55e 10%, transparent)',
                        color: disabled ? '#EA4335' : '#22c55e' }}>
                        {disabled ? 'Disabled' : 'Active'}
                      </span>
                    </td>
                    {/* ROLE */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {userIsSuperAdmin ? (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'var(--mono)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)' }}>
                          Super Admin
                        </span>
                      ) : (
                        <button onClick={() => handleRoleToggle(user.uid, !!user.isAdmin)}
                          style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'var(--mono)', cursor: 'pointer',
                            background: user.isAdmin ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--surface-2)',
                            color: user.isAdmin ? 'var(--accent)' : 'var(--muted)',
                            border: `1px solid ${user.isAdmin ? 'var(--accent)' : 'var(--border)'}` }}>
                          {user.isAdmin ? 'Admin' : 'User'}
                        </button>
                      )}
                    </td>
                    {/* CREATED */}
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)', fontSize: '0.8125rem' }}>
                      {formatDate(user.createdAt)}
                    </td>
                    {/* LAST LOGIN */}
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)', fontSize: '0.8125rem' }}>
                      {formatDate(user.lastLoginAt)}
                    </td>
                    {/* ACTIONS */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {!userIsSuperAdmin && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {disabled ? (
                            <button onClick={() => handleEnable(user.uid)} disabled={actionLoading === user.uid}
                              style={{ padding: '3px 8px', background: 'color-mix(in srgb, #22c55e 10%, transparent)', color: '#22c55e', border: '1px solid #22c55e', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--mono)' }}>
                              Enable
                            </button>
                          ) : (
                            <button onClick={() => handleDisable(user.uid)} disabled={actionLoading === user.uid}
                              style={{ padding: '3px 8px', background: 'transparent', color: '#E8A33D', border: '1px solid #E8A33D', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--mono)' }}>
                              Disable
                            </button>
                          )}
                          <button onClick={() => setTopupModal({ uid: user.uid, email: user.email || '' })}
                            style={{ padding: '3px 8px', background: 'color-mix(in srgb, #22c55e 10%, transparent)', color: '#22c55e', border: '1px solid #22c55e', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--mono)' }}>
                            + Token
                          </button>
                          <button onClick={() => handleDelete(user.uid, user.email || '')} disabled={actionLoading === user.uid}
                            style={{ padding: '3px 8px', background: 'transparent', color: '#EA4335', border: '1px solid #EA4335', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--mono)' }}>
                            Delete
                          </button>
                          <button onClick={() => setDeductModal({ uid: user.uid, email: user.email || '', currentTokens: user.tokens || 0 })}
                            style={{ padding: '3px 8px', background: 'transparent', color: '#EA4335', border: '1px solid #EA4335', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--mono)' }}>
                            - Token
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Token Topup Modal */}
      {topupModal && typeof document !== 'undefined' && (() => {
        const targetUser = users.find(u => u.uid === topupModal.uid);
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,9,10,0.5)', backdropFilter: 'blur(8px)' }}
            onClick={() => setTopupModal(null)}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '2rem', maxWidth: '400px', width: '90%' }}
              onClick={e => e.stopPropagation()}>
              <h3 style={{ fontFamily: 'var(--display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--ink)', margin: '0 0 0.5rem' }}>Topup Tokens</h3>
              <p style={{ fontFamily: 'var(--body)', fontSize: '0.8125rem', color: 'var(--muted)', margin: '0 0 1rem' }}>
                Add tokens to {topupModal.email}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                {[5, 10, 25, 50, 100].map(amt => (
                  <button key={amt} onClick={() => setTopupAmount(amt)}
                    style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      background: topupAmount === amt ? 'var(--accent)' : 'var(--surface-2)',
                      color: topupAmount === amt ? 'var(--base)' : 'var(--ink)',
                      border: `1px solid ${topupAmount === amt ? 'var(--accent)' : 'var(--border)'}` }}>
                    {amt}
                  </button>
                ))}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: '0.625rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Custom Amount</label>
                <input type="number" min="1" value={topupAmount} onChange={e => setTopupAmount(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--base)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: '0.875rem' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.625rem' }}>
                <button onClick={() => setTopupModal(null)}
                  style={{ flex: 1, padding: '0.6rem', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={() => handleTopup(topupModal.uid)} disabled={actionLoading === topupModal.uid || topupAmount < 1}
                  style={{ flex: 2, padding: '0.6rem', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 600, cursor: actionLoading === topupModal.uid ? 'not-allowed' : 'pointer', opacity: actionLoading === topupModal.uid ? 0.7 : 1 }}>
                  {actionLoading === topupModal.uid ? 'Adding...' : `Add ${topupAmount} Tokens`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Token Deduct Modal */}
      {deductModal && typeof document !== 'undefined' && (() => {
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,9,10,0.5)', backdropFilter: 'blur(8px)' }}
            onClick={() => setDeductModal(null)}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '2rem', maxWidth: '400px', width: '90%' }}
              onClick={e => e.stopPropagation()}>
              <h3 style={{ fontFamily: 'var(--display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--ink)', margin: '0 0 0.5rem' }}>Deduct Tokens</h3>
              <p style={{ fontFamily: 'var(--body)', fontSize: '0.8125rem', color: 'var(--muted)', margin: '0 0 0.5rem' }}>
                Remove tokens from {deductModal.email}
              </p>
              <p style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--accent)', margin: '0 0 1rem' }}>
                Current balance: {deductModal.currentTokens} tokens
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                {[1, 5, 10, 25, 50].map(amt => (
                  <button key={amt} onClick={() => setDeductAmount(Math.min(amt, deductModal.currentTokens))}
                    style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      background: deductAmount === amt ? '#EA4335' : 'var(--surface-2)',
                      color: deductAmount === amt ? '#fff' : 'var(--ink)',
                      border: `1px solid ${deductAmount === amt ? '#EA4335' : 'var(--border)'}` }}>
                    {amt}
                  </button>
                ))}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: '0.625rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Custom Amount (max {deductModal.currentTokens})</label>
                <input type="number" min="1" max={deductModal.currentTokens} value={deductAmount} onChange={e => setDeductAmount(Math.min(parseInt(e.target.value) || 0, deductModal.currentTokens))}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--base)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: '0.875rem' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.625rem' }}>
                <button onClick={() => setDeductModal(null)}
                  style={{ flex: 1, padding: '0.6rem', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={() => handleDeduct(deductModal.uid)} disabled={actionLoading === deductModal.uid || deductAmount < 1 || deductAmount > deductModal.currentTokens}
                  style={{ flex: 2, padding: '0.6rem', background: '#EA4335', color: '#fff', border: 'none', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 600, cursor: actionLoading === deductModal.uid ? 'not-allowed' : 'pointer', opacity: actionLoading === deductModal.uid ? 0.7 : 1 }}>
                  {actionLoading === deductModal.uid ? 'Removing...' : `Remove ${deductAmount} Tokens`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
