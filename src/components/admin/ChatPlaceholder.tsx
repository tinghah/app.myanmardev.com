import React from 'react';

export default function ChatPlaceholder() {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      display: 'flex',
      height: '70vh',
      overflow: 'hidden'
    }}>
      <div style={{
        width: '300px',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', fontWeight: 600, color: 'var(--ink)' }}>
          Active Chats
        </div>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
          No active chats.
        </div>
      </div>
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ fontSize: '3rem' }}>💬</div>
        <h3 style={{ color: 'var(--ink)', fontWeight: 600 }}>Chat System Coming Soon</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', maxWidth: '400px', textAlign: 'center' }}>
          This area will allow admins to respond to user support requests directly from the dashboard.
        </p>
      </div>
    </div>
  );
}
