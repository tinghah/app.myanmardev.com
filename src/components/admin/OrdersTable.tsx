import React, { useEffect, useState } from 'react';
import { getAllOrders } from '../../lib/admin';
import { updateOrderStatus } from '../../lib/orders';
import type { Order, OrderStatus } from '../../lib/orders';

export default function OrdersTable() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      const data = await getAllOrders();
      setOrders(data);
    } catch (e) {
      console.error("Failed to load orders", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    if (confirm(`Change order status to ${newStatus}?`)) {
      setUpdating(orderId);
      try {
        await updateOrderStatus(orderId, newStatus);
        await fetchOrders();
      } catch (e) {
        console.error("Failed to update order", e);
        alert("Failed to update order status");
      } finally {
        setUpdating(null);
      }
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--muted)' }}>Loading orders...</div>;
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'approved': return '#34A853';
      case 'completed': return 'var(--accent)';
      case 'pending': return '#E8A33D';
      case 'rejected': return '#EA4335';
      default: return 'var(--muted)';
    }
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
              <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Order Details</th>
              <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Type / Info</th>
              <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Cost</th>
              <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Date</th>
              <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id} style={{ borderBottom: '1px solid var(--border)', opacity: updating === order.id ? 0.5 : 1 }}>
                <td style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{order.userEmail}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>ID: {order.id}</div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: 600, color: 'var(--ink-2)', textTransform: 'capitalize' }}>
                    {order.type.replace('_', ' ')}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                    {order.type === 'token_purchase' ? (
                      `Paid via ${order.paymentMethod || 'Unknown'}`
                    ) : (
                      Object.entries(order.details || {}).map(([k,v]) => `${k}: ${v}`).join(', ')
                    )}
                  </div>
                </td>
                <td style={{ padding: '1rem', fontWeight: 600, fontFamily: 'var(--mono)' }}>
                  {order.type === 'token_purchase' ? (
                    <span style={{ color: '#34A853' }}>${order.priceUSD.toFixed(2)}</span>
                  ) : (
                    <span style={{ color: 'var(--accent)' }}>🪙 {order.tokensUsed}</span>
                  )}
                  {order.type === 'token_purchase' && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>+{order.tokenAmount} Tokens</div>
                  )}
                </td>
                <td style={{ padding: '1rem', color: 'var(--muted)', fontSize: '0.875rem' }}>
                  {formatDate(order.createdAt)}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: `color-mix(in srgb, ${getStatusColor(order.status)} 10%, transparent)`,
                    color: getStatusColor(order.status),
                    textTransform: 'capitalize'
                  }}>
                    {order.status}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  {order.type === 'token_purchase' && order.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={() => handleStatusChange(order.id!, 'approved')}
                        disabled={updating === order.id}
                        style={{ background: '#34A853', color: '#fff', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => handleStatusChange(order.id!, 'rejected')}
                        disabled={updating === order.id}
                        style={{ background: 'transparent', color: '#EA4335', border: '1px solid #EA4335', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                  No orders found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
