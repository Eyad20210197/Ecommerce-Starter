import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { productName, productDescription } from '../lib/formatters.js';
import { buildImageUrl } from '../lib/imagekit.js';
import { starterProducts } from '../config/starterCatalog.js';
import { EmptyState } from '../components/common/EmptyState.jsx';
import { ShoppingBag, Check, ArrowLeft, ShieldCheck } from 'lucide-react';

export function ProductDetailPage({ productId, onNavigate }) {
  const { language, formatPrice, subscribeStock, storeConfig, t } = useStore();
  const { addToCart } = useCart();
  const { notice } = useToast();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stock, setStock] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    let active = true;
    async function fetchProduct() {
      try {
        setLoading(true);
        const res = await api(`/catalog/products/${productId}`);
        if (active && res.product) {
          setProduct(res.product);
          setStock(res.product.available || 0);
          const gallery = res.product.images?.length ? res.product.images : (res.product.image_url ? [{ url: res.product.image_url, alt: res.product.name, is_primary: true }] : []);
          setSelectedImage(gallery.find(image => image.is_primary)?.url || gallery[0]?.url || null);
        }
      } catch (err) {
        console.warn('Product fetch notice (using starter catalog):', err.message);
        const match = starterProducts.find(p => p.id === productId || p.sku === productId) || starterProducts[0];
        if (active && match) {
          setProduct(match);
          setStock(match.available || 0);
          setSelectedImage(match.image_url);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchProduct();
    return () => { active = false; };
  }, [productId]);

  // Subscribe to live inventory events
  useEffect(() => {
    if (!productId) return;
    const unsubscribe = subscribeStock(productId, async () => {
      try {
        const res = await api(`/catalog/products/${productId}`);
        if (res.product) {
          setStock(res.product.available || 0);
        }
      } catch {
        // Soft fail
      }
    });

    return unsubscribe;
  }, [productId, subscribeStock]);

  const handleAddToCart = async (e) => {
    e.preventDefault();
    if (!product || stock <= 0 || adding) return;

    try {
      setAdding(true);
      await addToCart(product.id, quantity);
      setAdded(true);
      notice(t('Added to cart.'));
      setTimeout(() => setAdded(false), 2000);
    } catch (err) {
      notice(err.message, true);
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="container-page narrow">
        <p className="loading-text">{t('Loading…')}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container-page">
        <EmptyState 
          title={t('Product not found')}
          subtitle={t('This product may have been archived or is no longer available.')}
          actionLabel={t('Back to shop')}
          onAction={() => onNavigate('/')}
        />
      </div>
    );
  }

  const title = productName(product, language);
  const description = productDescription(product, language);
  const isAvailable = Boolean(stock > 0 && product.active !== false);
  const maxQty = Math.min(100, Math.max(1, stock));
  const gallery = product.images?.length ? product.images : (product.image_url ? [{ url: product.image_url, alt: title, is_primary: true }] : []);
  const displayedImage = gallery.find(image => image.url === selectedImage) || gallery[0] || null;

  return (
    <div className="container-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <a href="#/" onClick={(e) => { e.preventDefault(); onNavigate('/'); }} className="breadcrumb-link">
          <ArrowLeft size={16} />
          <span>{t('Shop')}</span>
        </a>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">{title}</span>
      </nav>

      <div className="product-detail-layout">
        {/* Media Column */}
        <div className="product-detail-media">
          {displayedImage ? (
            <>
              <div className="product-detail-main-image">
                <img 
                  src={buildImageUrl(displayedImage.url, { width: 1000, height: 1000 })} 
                  alt={displayedImage.alt || title} 
                  className="product-detail-img"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.classList.add('no-image');
                  }}
                />
              </div>
              {gallery.length > 1 && (
                <div className="product-gallery-thumbnails" aria-label={t('Product photos')}>
                  {gallery.map((image, index) => (
                    <button
                      type="button"
                      key={image.id || image.url}
                      className={`product-gallery-thumbnail ${displayedImage.url === image.url ? 'is-selected' : ''}`}
                      onClick={() => setSelectedImage(image.url)}
                      aria-label={`${t('View photo')} ${index + 1}`}
                      aria-pressed={displayedImage.url === image.url}
                    >
                      <img src={buildImageUrl(image.url, { width: 144, height: 144 })} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="product-detail-placeholder">
              <span>{t('No image')}</span>
            </div>
          )}
        </div>

        {/* Information & Actions Column */}
        <div className="product-detail-info">
          {product.category_name && (
            <span className="product-detail-category">{product.category_name}</span>
          )}

          <h1 className="product-detail-title">{title}</h1>

          <div className="product-detail-price-wrap">
            <span className="product-detail-price">
              {formatPrice(product.price_minor, true)}
            </span>
            <span className={`status-pill ${isAvailable ? 'status-delivered' : 'status-cancelled'}`}>
              {isAvailable ? `${stock} ${t('available').toLowerCase()}` : t('Out of stock')}
            </span>
          </div>

          <form onSubmit={handleAddToCart} className="product-detail-actions">
            <div className="quantity-counter">
              <label htmlFor="quantity-input" className="visually-hidden">{t('Quantity')}</label>
              <button 
                type="button" 
                className="qty-btn"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                disabled={quantity <= 1 || !isAvailable}
              >
                -
              </button>
              <input 
                id="quantity-input"
                type="number" 
                min="1" 
                max={maxQty} 
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) setQuantity(Math.max(1, Math.min(maxQty, val)));
                }}
                disabled={!isAvailable}
                className="qty-input"
              />
              <button 
                type="button" 
                className="qty-btn"
                onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
                disabled={quantity >= maxQty || !isAvailable}
              >
                +
              </button>
            </div>

            <button 
              type="submit" 
              className={`btn btn-primary btn-add-cart ${added ? 'btn-added' : ''}`}
              disabled={!isAvailable || adding}
            >
              {added ? (
                <>
                  <Check size={18} />
                  <span>{t('Saved.')}</span>
                </>
              ) : (
                <>
                  <ShoppingBag size={18} />
                  <span>{adding ? t('Loading…') : isAvailable ? t('Add to cart') : t('Out of stock')}</span>
                </>
              )}
            </button>
          </form>

          {description && (
            <div className="product-detail-desc">
              <h4>{t('Description')}</h4>
              <p>{description}</p>
            </div>
          )}

          <div className="product-detail-meta">
            <div className="meta-item">
              <span className="meta-label">{t('Product code')}:</span>
              <span className="meta-value">{product.sku}</span>
            </div>

            {storeConfig.features.serialNumberTracking && product.serialized && (
              <div className="meta-item">
                <ShieldCheck size={16} className="text-success" />
                <span className="meta-value">{t('Authenticity verified')}</span>
              </div>
            )}

            {product.tags && product.tags.length > 0 && (
              <div className="meta-item tags-item">
                <span className="meta-label">{t('Tags')}:</span>
                <div className="tag-list">
                  {product.tags.map(tag => (
                    <span key={tag} className="tag-pill">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
