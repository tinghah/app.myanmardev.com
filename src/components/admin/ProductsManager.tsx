import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getAllProducts, createProduct, updateProduct, deleteProduct, type Product } from '../../lib/products';

const EMPTY_PRODUCT: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  slug: '',
  description: '',
  features: [],
  priceUSD: 0,
  priceMMK: 0,
  tokenCost: 10,
  status: 'comingsoon',
  category: '',
  icon: '📦',
  sortOrder: 0,
  duration: 6,
};

export default function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [featuresInput, setFeaturesInput] = useState('');

  const fetchProducts = async () => {
    try {
      const data = await getAllProducts();
      setProducts(data);
    } catch (e) {
      console.error('Failed to load products', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_PRODUCT, sortOrder: products.length });
    setFeaturesInput('');
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      slug: p.slug,
      description: p.description,
      features: p.features,
      priceUSD: p.priceUSD,
      priceMMK: p.priceMMK,
      tokenCost: p.tokenCost,
      status: p.status,
      category: p.category,
      icon: p.icon,
      sortOrder: p.sortOrder,
      duration: p.duration ?? 6,
    });
    setFeaturesInput(p.features.join(', '));
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const features = featuresInput.split(',').map((f) => f.trim()).filter(Boolean);
      const data = { ...form, features, slug: form.slug || form.name.toLowerCase().replace(/\s+/g, '-') };

      if (editing?.id) {
        await updateProduct(editing.id, data);
      } else {
        await createProduct(data);
      }
      setShowModal(false);
      await fetchProducts();
    } catch (e: any) {
      alert('Failed to save: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteProduct(id);
      await fetchProducts();
    } catch (e: any) {
      alert('Failed to delete: ' + (e.message || e));
    }
  };

  const handleStatusToggle = async (p: Product) => {
    if (!p.id) return;
    const newStatus = p.status === 'live' ? 'comingsoon' : 'live';
    await updateProduct(p.id, { status: newStatus });
    await fetchProducts();
  };

  if (loading) return <div style={{ color: 'var(--muted)', padding: '1rem' }}>Loading products...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--display)', fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
          Products ({products.length})
        </h3>
        <button onClick={openCreate} style={{ background: 'var(--accent)', color: 'var(--base)', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
          + Add Product
        </button>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['Product', 'Price', 'Tokens', 'Status', 'Order', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '0.75rem 1rem', color: 'var(--muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' as const }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.icon} {p.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{p.slug}</div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--mono)', fontSize: '0.875rem' }}>
                    ${(p.tokenCost * 0.5).toFixed(2)}
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{(p.tokenCost * 2000).toLocaleString()} MMK</div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--accent)' }}>
                    🪙 {p.tokenCost}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <button onClick={() => handleStatusToggle(p)} style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, background: p.status === 'live' ? 'color-mix(in srgb, #22c55e 15%, transparent)' : 'color-mix(in srgb, var(--muted) 15%, transparent)', color: p.status === 'live' ? '#22c55e' : 'var(--muted)' }}>
                      {p.status === 'live' ? '● LIVE' : '○ SOON'}
                    </button>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
                    {p.sortOrder}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => openEdit(p)} style={{ background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => handleDelete(p.id!, p.name)} style={{ background: 'transparent', color: '#EA4335', border: '1px solid #EA4335', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No products yet. Click "Add Product" to create one.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,9,10,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setShowModal(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '2rem', maxWidth: '560px', width: '90%', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--ink)', margin: '0 0 1.25rem' }}>{editing ? 'Edit Product' : 'New Product'}</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--base)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: '0.875rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Slug</label>
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated from name" style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--base)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: '0.875rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--base)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: '0.875rem', resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Features (comma-separated)</label>
                <input value={featuresInput} onChange={(e) => setFeaturesInput(e.target.value)} placeholder="Instant DNS, Free SSL, GitHub Pages support" style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--base)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: '0.875rem' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Token Cost</label>
                  <input type="number" min="1" value={form.tokenCost} onChange={(e) => {
                    const tokens = parseInt(e.target.value) || 10;
                    setForm({ ...form, tokenCost: tokens, priceUSD: tokens * 0.5, priceMMK: tokens * 2000 });
                  }} style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--base)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: '0.875rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Price USD (auto)</label>
                  <input type="text" value={`$${(form.tokenCost * 0.5).toFixed(2)}`} readOnly style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface-2)', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '0.875rem', cursor: 'not-allowed' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Price MMK (auto)</label>
                  <input type="text" value={`${(form.tokenCost * 2000).toLocaleString()} MMK`} readOnly style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface-2)', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '0.875rem', cursor: 'not-allowed' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'live' | 'comingsoon' })} style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--base)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: '0.875rem' }}>
                    <option value="live">Live</option>
                    <option value="comingsoon">Coming Soon</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Icon (emoji)</label>
                  <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--base)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: '0.875rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Sort Order</label>
                  <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--base)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: '0.875rem' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Duration (months)</label>
                  <input type="number" min="1" value={form.duration ?? 6} onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 6 })} style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--base)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: '0.875rem' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Category</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="dns, hosting, portfolio" style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--base)', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: '0.875rem' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1.25rem' }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '0.7rem', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name} style={{ flex: 2, padding: '0.7rem', background: !form.name || saving ? 'var(--surface)' : 'var(--accent)', color: !form.name || saving ? 'var(--muted)' : 'var(--base)', border: 'none', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 600, cursor: !form.name || saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : editing ? 'Update Product' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
