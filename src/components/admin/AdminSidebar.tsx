import React from 'react';
import { useStore } from '@nanostores/react';
import { $authState } from '../../stores/authStore';

interface AdminSidebarProps {
  currentPath: string;
  lang: string;
}

export default function AdminSidebar({ currentPath, lang }: AdminSidebarProps) {
  const { profile } = useStore($authState);

  const navItems = [
    { name: 'Users', path: `/${lang}/admin/users`, icon: '👥' },
    { name: 'Redeem Codes', path: `/${lang}/admin/codes`, icon: '🎟️' },
    { name: 'Orders', path: `/${lang}/admin/orders`, icon: '📦' },
    { name: 'Chat', path: `/${lang}/admin/chat`, icon: '💬' },
  ];

  return (
    <aside style={{
      width: '250px',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      height: '100vh',
      position: 'sticky',
      top: 0,
      display: 'flex',
      flexDirection: 'column',
      padding: '1.5rem',
    }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{
          fontFamily: 'var(--display)',
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--ink)',
          marginBottom: '0.25rem'
        }}>
          Admin Panel
        </h2>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: '0.75rem',
          color: 'var(--muted)',
          wordBreak: 'break-all'
        }}>
          {profile?.email}
        </div>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {navItems.map((item) => {
          const isActive = currentPath.includes(item.path);
          return (
            <a
              key={item.path}
              href={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                textDecoration: 'none',
                fontFamily: 'var(--mono)',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--base)' : 'var(--ink)',
                background: isActive ? 'var(--accent)' : 'transparent',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--surface-2)';
                }
              }}
              onMouseOut={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
              {item.name}
            </a>
          );
        })}
      </nav>
      
      <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
        <a 
          href={`/${lang}/dashboard`}
          style={{
            display: 'block',
            padding: '0.75rem',
            textAlign: 'center',
            color: 'var(--ink)',
            textDecoration: 'none',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontFamily: 'var(--mono)',
            fontSize: '0.8125rem'
          }}
        >
          ← Back to App
        </a>
      </div>
    </aside>
  );
}
