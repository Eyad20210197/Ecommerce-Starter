import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { productName } from '../../lib/formatters.js';
import { buildImageUrl } from '../../lib/imagekit.js';
import { ShoppingBag, Check } from 'lucide-react';

export function ProductCard({ product, onNavigate }) {
  const { language, formatPrice, subscribeStock, t } = useStore();
  const { addToCart } = useCart();
  const { notice } = useToast();
  
  const [stock, setStock] = useState(product.available || 0);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  // Subscribe to live inventory SSE updates
  useEffect(() => {
    setStock(product.available || 0);
    const unsubscribe = subscribeStock(product.id, async () => {
      // Stock changed event received
      try {
        const res = await fetch(`/api/v1/catalog/products/${product.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.product?.available !== undefined) {
            setStock(data.product.available);
          }
        }
      } catch {
        // Soft fail
      }
    });

    return unsubscribe;
  }, [product.id, product.available, subscribeStock]);

  const isAvailable = Boolean(stock && stock > 0 && product.active !== false);
  const title = productName(product, language);

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAvailable || adding) return;

    try {
      setAdding(true);
      await addToCart(product.id, 1);
      setAdded(true);
      notice(t('Added to cart.'));
      setTimeout(() => setAdded(false), 1500);
    } catch (err) {
      notice(err.message, true);
    } finally {
      setAdding(false);
    }
  };

  const handleCardClick = (e) => {
    e.preventDefault();
    onNavigate(`/products/${product.id}`);
  };

  return (
    <article className="product-card">
      <a href={`#/products/${product.id}`} onClick={handleCardClick} className="product-card-media">
        {product.image_url ? (
          <img 
            src={buildImageUrl(product.image_url, { width: 400, height: 400 })} 
            alt={title} 
            loading="lazy" 
            className="product-card-img"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentElement.classList.add('no-image');
            }}
          />
        ) : (
          <div className="product-card-placeholder">
            <span>{t('No image')}</span>
          </div>
        )}
      </a>

      <div className="product-card-content">
        {product.category_name && (
          <span className="product-card-category">{product.category_name}</span>
        )}
        <h3 className="product-card-title">
          <a href={`#/products/${product.id}`} onClick={handleCardClick}>
            {title}
          </a>
        </h3>
        
        <div className="product-card-bottom">
          <div className="product-card-pricing">
            <span className="product-card-price">
              {formatPrice(product.price_minor, true)}
            </span>
            <span className={`product-card-stock ${isAvailable ? 'in-stock' : 'out-of-stock'}`}>
              {isAvailable ? `${stock} ${t('available').toLowerCase()}` : t('Out of stock')}
            </span>
          </div>

          <button 
            type="button" 
            className={`btn btn-quick-add ${added ? 'btn-added' : ''}`}
            onClick={handleQuickAdd}
            disabled={!isAvailable || adding}
            aria-label={t(isAvailable ? 'Add to cart' : 'Out of stock')}
          >
            {added ? (
              <Check size={16} />
            ) : (
              <>
                <ShoppingBag size={16} />
                <span>{adding ? t('Loading…') : isAvailable ? t('Add to cart') : t('Out of stock')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
