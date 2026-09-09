import React from 'react';
import { useStore } from '../context/StoreContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { productName } from '../lib/formatters.js';
import { buildImageUrl } from '../lib/imagekit.js';
import { EmptyState } from '../components/common/EmptyState.jsx';
import { Trash2, ShoppingBag, ArrowRight } from 'lucide-react';

export function CartPage({ onNavigate }) {
  const { language, formatPrice, t } = useStore();
  const { items, updateQuantity, removeFromCart, summary, hasUnavailableItems } = useCart();

  if (!items.length) {
    return (
      <div className="container-page">
        <h1>{t('Your cart')}</h1>
        <EmptyState 
          title="Your cart is empty"
          subtitle="Explore our catalog and find items you love."
          actionLabel="Continue shopping"
          onAction={() => onNavigate('/')}
          icon={<ShoppingBag size={48} />}
        />
      </div>
    );
  }

  return (
    <div className="container-page">
      <h1>{t('Your cart')}</h1>

      <div className="cart-layout">
        {/* Cart Line Items */}
        <section className="cart-items-section" aria-label="Cart Items">
          {items.map(item => {
            const title = productName(item, language);
            const isUnavailable = !item.active || (item.available !== undefined && item.available < item.quantity);
            const maxQty = item.available !== undefined ? Math.max(1, item.available) : 100;

            return (
              <article key={item.product_id} className="cart-item-row">
                <a 
                  href={`#/products/${item.product_id}`} 
                  onClick={(e) => { e.preventDefault(); onNavigate(`/products/${item.product_id}`); }}
                  className="cart-item-thumb"
                >
                  {item.image_url ? (
                    <img src={buildImageUrl(item.image_url, { width: 160, height: 160 })} alt={title} />
                  ) : (
                    <div className="cart-thumb-placeholder">{t('No image')}</div>
                  )}
                </a>

                <div className="cart-item-details">
                  <h3 className="cart-item-title">
                    <a 
                      href={`#/products/${item.product_id}`}
                      onClick={(e) => { e.preventDefault(); onNavigate(`/products/${item.product_id}`); }}
                    >
                      {title}
                    </a>
                  </h3>
                  <span className="cart-item-unit-price">
                    {formatPrice(item.price_minor, true)}
                  </span>

                  <div className="cart-item-controls">
                    <div className="quantity-counter small">
                      <button 
                        type="button" 
                        className="qty-btn"
                        onClick={() => updateQuantity(item.product_id, Math.max(1, item.quantity - 1))}
                        disabled={item.quantity <= 1}
                      >
                        -
                      </button>
                      <input 
                        type="number" 
                        min="1" 
                        max={maxQty} 
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val >= 1) {
                            updateQuantity(item.product_id, Math.min(maxQty, val));
                          }
                        }}
                        className="qty-input"
                      />
                      <button 
                        type="button" 
                        className="qty-btn"
                        onClick={() => updateQuantity(item.product_id, Math.min(maxQty, item.quantity + 1))}
                        disabled={item.quantity >= maxQty}
                      >
                        +
                      </button>
                    </div>

                    <button 
                      type="button" 
                      className="btn-remove-item"
                      onClick={() => removeFromCart(item.product_id)}
                      title={t('Remove')}
                      aria-label={t('Remove')}
                    >
                      <Trash2 size={16} />
                      <span>{t('Remove')}</span>
                    </button>
                  </div>

                  {isUnavailable && (
                    <p className="cart-error-note">{t('Out of stock')}</p>
                  )}
                </div>

                <div className="cart-item-total">
                  <strong>{formatPrice(item.price_minor * item.quantity, true)}</strong>
                </div>
              </article>
            );
          })}
        </section>

        {/* Order Summary Aside */}
        <aside className="cart-summary-aside">
          <div className="panel summary-panel">
            <h2>{t('Order summary')}</h2>

            <div className="summary-rows">
              <div className="summary-row">
                <span>{t('Subtotal')}</span>
                <span>{formatPrice(summary.subtotalMinor, false)}</span>
              </div>
              <div className="summary-row">
                <span>{t('Shipping')}</span>
                <span>{formatPrice(summary.shippingMinor, false)}</span>
              </div>
              <div className="summary-row">
                <span>{t('Tax')}</span>
                <span>{formatPrice(summary.taxMinor, false)}</span>
              </div>
              <div className="summary-row total-row">
                <span>{t('Total')}</span>
                <strong>{formatPrice(summary.totalMinor, false)}</strong>
              </div>
            </div>

            <button 
              type="button" 
              className="btn btn-primary btn-block btn-checkout"
              disabled={hasUnavailableItems}
              onClick={() => onNavigate('/checkout')}
            >
              <span>{t('Checkout')}</span>
              <ArrowRight size={18} />
            </button>

            {hasUnavailableItems && (
              <p className="summary-warning">{t('Some items are out of stock. Please update your cart before checking out.')}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
