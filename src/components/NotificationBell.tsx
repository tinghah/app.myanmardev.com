import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { $authState } from '../stores/authStore';
import {
  subscribeToNotifications,
  markAsRead,
  markAllAsRead,
  type Notification,
} from '../lib/notifications';

const TYPE_ICONS: Record<string, string> = {
  token_topup: '🪙',
  token_deduction: '💸',
  order_created: '📦',
  order_approved: '✅',
  order_completed: '🎉',
  subdomain_created: '🌐',
  subdomain_deleted: '🗑️',
  user_signin: '🔑',
  admin_action: '⚙️',
  system: '🔔',
};

function timeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const { user } = useStore($authState);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToNotifications(user.uid, setNotifications);
    return () => unsub();
  }, [user?.uid]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (!user) return null;

  const handleMarkAllRead = async () => {
    await markAllAsRead(user.uid, notifications);
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) {
      await markAsRead(user.uid, n.id);
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          background: open ? 'var(--surface-2)' : 'transparent',
          border: '1px solid var(--border)',
          borderRadius: '7px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          color: 'var(--muted)',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-accent)';
          e.currentTarget.style.background = 'var(--surface-2)';
        }}
        onMouseOut={(e) => {
          if (!open) {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.background = 'transparent';
          }
        }}
        aria-label="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            minWidth: '16px',
            height: '16px',
            padding: '0 4px',
            borderRadius: '999px',
            background: '#ef4444',
            color: '#fff',
            fontFamily: 'var(--mono)',
            fontSize: '0.5625rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '360px',
          maxHeight: '440px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.4), 0 0 0 1px var(--border)',
          overflow: 'hidden',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.875rem 1rem',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{
              fontFamily: 'var(--display)',
              fontWeight: 700,
              fontSize: '0.875rem',
              color: 'var(--ink)',
            }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontFamily: 'var(--mono)',
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                fontFamily: 'var(--mono)',
                fontSize: '0.75rem',
                color: 'var(--muted)',
              }}>
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    padding: '0.875rem 1rem',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease',
                    background: n.read ? 'transparent' : 'color-mix(in srgb, var(--accent) 4%, transparent)',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = n.read ? 'transparent' : 'color-mix(in srgb, var(--accent) 4%, transparent)';
                  }}
                >
                  <span style={{ fontSize: '1.1rem', flexShrink: 0, lineHeight: 1.4 }}>
                    {TYPE_ICONS[n.type] || '🔔'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0,
                      fontFamily: 'var(--body)',
                      fontSize: '0.8125rem',
                      color: 'var(--ink)',
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {n.message}
                    </p>
                    <span style={{
                      fontFamily: 'var(--mono)',
                      fontSize: '0.5625rem',
                      color: 'var(--muted)',
                      marginTop: '0.2rem',
                      display: 'block',
                    }}>
                      {timeAgo(n.timestamp)}
                    </span>
                  </div>
                  {!n.read && (
                    <div style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      flexShrink: 0,
                      marginTop: '6px',
                    }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
