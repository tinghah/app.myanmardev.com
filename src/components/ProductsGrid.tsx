import React, { useState, useEffect } from 'react';
import { getAllProducts, type Product } from '../lib/products';

export default function ProductsGrid() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllProducts()
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
        Loading products...
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
        No products available yet.
      </div>
    );
  }

  return (
    <div className="products-grid">
      {products.map((product) => (
        <div key={product.id} className={`product-card card-glass${product.status === 'live' ? ' card-featured' : ''}`}>
          <div className="product-card-top">
            <div className={`product-icon ${product.status === 'live' ? 'product-icon--live' : 'product-icon--soon'}`}>
              <span style={{ fontSize: '1.5rem' }}>{product.icon}</span>
            </div>
            <div className={`badge ${product.status === 'live' ? 'badge--live' : 'badge--soon'}`}>
              {product.status === 'live' ? 'Live' : 'Coming Soon'}
            </div>
          </div>
          <div className="product-body">
            <h3 className="h-card product-name">{product.name}</h3>
            <p className="product-desc">{product.description}</p>
            <ul className="product-features">
              {product.features.map((f, i) => (
                <li key={i}>
                  <span className={`feat-check${product.status !== 'live' ? ' feat-check--muted' : ''}`}>
                    {product.status === 'live' ? '✓' : '○'}
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="product-footer">
            <div className="product-price-block">
              <span className="price-usd">${product.priceUSD.toFixed(2)}</span>
              <span className="price-per"> / {product.tokenCost} tokens</span>
              <div className="price-mmk">{product.priceMMK?.toLocaleString()} MMK</div>
            </div>
            {product.status === 'live' ? (
              <a href="/en/auth/signin" className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}>
                Order Now →
              </a>
            ) : (
              <button className="btn btn--ghost" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }} disabled>
                Coming Soon
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
