import React, { useEffect, useState } from 'react';
import { getAllUsers } from '../../lib/admin';
import type { UserProfile } from '../../lib/auth';

export default function UsersTable() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const data = await getAllUsers();
        setUsers(data);
      } catch (e) {
        console.error("Failed to load users", e);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

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
              <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Created</th>
              <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Last Login</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.uid} style={{ borderBottom: '1px solid var(--border)' }}>
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
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{user.displayName || 'No Name'} {user.isAdmin && <span style={{ fontSize: '0.75rem', color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.5rem' }}>Admin</span>}</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{user.email || user.githubUsername || 'No Email'}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.2rem', fontFamily: 'var(--mono)' }}>{user.uid}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '1rem', color: 'var(--ink-2)', fontSize: '0.875rem' }}>
                  {user.provider}
                </td>
                <td style={{ padding: '1rem', color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--mono)' }}>
                  {user.tokens}
                </td>
                <td style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.875rem' }}>
                  {formatDate(user.createdAt)}
                </td>
                <td style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.875rem' }}>
                  {formatDate(user.lastLoginAt)}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
