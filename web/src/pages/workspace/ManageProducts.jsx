import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext.jsx';
import { useModal } from '../../context/ModalContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../lib/api.js';
import { Badge } from '../../components/common/Badge.jsx';
import { Pagination } from '../../components/common/Pagination.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { ImageKitUploader } from '../../components/common/ImageKitUploader.jsx';
import { buildImageUrl } from '../../lib/imagekit.js';
import { Plus, Search, Edit3, Archive, Layers, Image as ImageIcon, Star, Trash2 } from 'lucide-react';

export function ManageProducts({ searchParams, onNavigate }) {
  const { language, formatPrice, storeConfig, t } = useStore();
  const { openModal, closeModal } = useModal();
  const { notice } = useToast();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [searchQ, setSearchQ] = useState(searchParams.get('q') || '');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams(searchParams);
      q.set('all', 'true');
      q.set('limit', '30');
      q.set('page', String(page));
      if (searchQ) q.set('q', searchQ);
      else q.delete('q');

      const [prodRes, catRes] = await Promise.all([
        api(`/catalog/products?${q.toString()}`),
        api('/catalog/categories')
      ]);

      setProducts(prodRes.products || []);
      setTotal(prodRes.total || 0);
      setCategories(catRes.categories || []);
    } catch (err) {
      console.error('Failed to load products', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [searchParams, page, searchQ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const q = new URLSearchParams(searchParams);
    if (searchQ.trim()) q.set('q', searchQ.trim());
    else q.delete('q');
    q.delete('page');
    onNavigate(`/manage/products?${q.toString()}`);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    const q = new URLSearchParams(searchParams);
    q.set('page', String(newPage));
    onNavigate(`/manage/products?${q.toString()}`);
  };

  // Add or Edit Product Modal
  const handleOpenProductModal = (productToEdit = null) => {
    const isEdit = Boolean(productToEdit);

    openModal(
      isEdit ? 'Edit' : 'Add product',
      ({ close }) => {
        const [sku, setSku] = useState(productToEdit?.sku || '');
        const [name, setName] = useState(productToEdit?.name || '');
        const [price, setPrice] = useState(productToEdit ? (productToEdit.price_minor / 100).toFixed(2) : '');
        const [categoryId, setCategoryId] = useState(productToEdit?.category_id || '');
        const [description, setDescription] = useState(productToEdit?.description || '');
        const [tags, setTags] = useState(productToEdit?.tags?.join(', ') || '');
        const [images, setImages] = useState(() => {
          if (productToEdit?.images?.length) return productToEdit.images.map(image => ({ url: image.url, alt: image.alt || productToEdit.name }));
          return productToEdit?.image_url ? [{ url: productToEdit.image_url, alt: productToEdit.name }] : [];
        });
        const [newImageUrl, setNewImageUrl] = useState('');
        const [arName, setArName] = useState(productToEdit?.translations?.ar?.name || '');
        const [arDescription, setArDescription] = useState(productToEdit?.translations?.ar?.description || '');
        const [active, setActive] = useState(productToEdit ? productToEdit.active : true);
        const [serialized, setSerialized] = useState(productToEdit ? productToEdit.serialized : false);
        const [submitting, setSubmitting] = useState(false);
        const [error, setError] = useState('');

        const handleSubmit = async (e) => {
          e.preventDefault();
          try {
            setSubmitting(true);
            setError('');

            const body = {
              sku: sku.trim(),
              name: name.trim(),
              description: description.trim(),
              price_minor: Math.round(Number(price) * 100),
              category_id: categoryId || null,
              tags: tags.split(',').map(s => s.trim()).filter(Boolean),
              image_url: images[0]?.url || '',
              images: images.map(image => ({ url: image.url, alt: name.trim() })),
              translations: arName ? { ar: { name: arName.trim(), description: arDescription.trim() } } : {},
              active,
              serialized: productToEdit ? productToEdit.serialized : serialized,
              ...(productToEdit ? { version: productToEdit.version } : {})
            };

            if (isEdit) {
              await api(`/catalog/products/${productToEdit.id}`, { method: 'PATCH', body });
            } else {
              await api('/catalog/products', { method: 'POST', body });
            }

            await loadData();
            notice(t('Saved.'));
            close();
          } catch (err) {
            setError(err.message);
          } finally {
            setSubmitting(false);
          }
        };

        return (
          <form onSubmit={handleSubmit} className="stack">
            {error && <div className="alert-box alert-error">{error}</div>}

            <div className="form-grid">
              <div className="form-group">
                <label className="field-label">{t('SKU')}</label>
                <input 
                  type="text" 
                  required 
                  maxLength={80}
                  value={sku} 
                  onChange={e => setSku(e.target.value)} 
                  className="input-field" 
                />
              </div>

              <div className="form-group">
                <label className="field-label">{t('Product name')}</label>
                <input 
                  type="text" 
                  required 
                  maxLength={160}
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="input-field" 
                />
              </div>

              <div className="form-group">
                <label className="field-label">{t('Price')}</label>
                <input 
                  type="number" 
                  required 
                  min="0" 
                  step="0.01"
                  value={price} 
                  onChange={e => setPrice(e.target.value)} 
                  className="input-field" 
                />
              </div>

              <div className="form-group">
                <label className="field-label">{t('Category')}</label>
                <select 
                  value={categoryId} 
                  onChange={e => setCategoryId(e.target.value)}
                  className="input-field"
                >
                  <option value="">—</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group span-2">
                <label className="field-label">{t('Description')}</label>
                <textarea 
                  maxLength={8000}
                  rows={3}
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  className="input-field input-textarea" 
                />
              </div>

              <div className="form-group">
                <label className="field-label">{t('Tags')}</label>
                <input 
                  type="text" 
                  maxLength={800}
                  placeholder="tag1, tag2, tag3"
                  value={tags} 
                  onChange={e => setTags(e.target.value)} 
                  className="input-field" 
                />
              </div>

              <div className="form-group span-2">
                <label className="field-label">{t('Product photos')}</label>
                <p className="field-help-text">{t('Add photos here. The first photo is used on the store and product cards.')}</p>
                {images.length > 0 && (
                  <div className="product-media-editor" aria-label={t('Product photos')}>
                    {images.map((image, index) => (
                      <div className={`product-media-tile ${index === 0 ? 'is-primary' : ''}`} key={image.url}>
                        <img src={buildImageUrl(image.url, { width: 180, height: 180 })} alt="" />
                        {index === 0 && <span className="product-media-main-label"><Star size={13} fill="currentColor" /> {t('Main photo')}</span>}
                        <div className="product-media-actions">
                          {index > 0 && <button type="button" className="btn btn-sm btn-secondary" onClick={() => setImages(current => [current[index], ...current.filter((_, currentIndex) => currentIndex !== index)])}>{t('Make main')}</button>}
                          <button type="button" className="btn btn-sm btn-outline-danger" aria-label={t('Remove photo')} onClick={() => setImages(current => current.filter((_, currentIndex) => currentIndex !== index))}><Trash2 size={15} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {images.length < 12 && <ImageKitUploader
                  value={newImageUrl}
                  onChange={(url) => {
                    setNewImageUrl(url);
                    if (url && !images.some(image => image.url === url)) setImages(current => [...current, { url, alt: name.trim() }]);
                  }}
                  label={images.length ? t('Add another photo') : t('Add product photo')}
                  folder="/products"
                />}
              </div>

              {storeConfig.features.multiLanguage && (
                <>
                  <div className="form-group">
                    <label className="field-label">{t('Arabic name')}</label>
                    <input 
                      type="text" 
                      maxLength={160}
                      value={arName} 
                      onChange={e => setArName(e.target.value)} 
                      className="input-field" 
                    />
                  </div>

                  <div className="form-group span-2">
                    <label className="field-label">{t('Arabic description')}</label>
                    <textarea 
                      maxLength={8000}
                      rows={3}
                      value={arDescription} 
                      onChange={e => setArDescription(e.target.value)} 
                      className="input-field input-textarea" 
                    />
                  </div>
                </>
              )}

              <div className="form-group span-2">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={active} 
                    onChange={e => setActive(e.target.checked)} 
                  />
                  <span>{t('Active')}</span>
                </label>
              </div>

              {storeConfig.features.serialNumberTracking && (
                <div className="form-group span-2">
                  {productToEdit ? (
                    <p className="muted-small">
                      {t('Track serial numbers')}: {t(productToEdit.serialized ? 'Enabled' : 'Disabled')}
                    </p>
                  ) : (
                    <label className="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={serialized} 
                        onChange={e => setSerialized(e.target.checked)} 
                      />
                      <span>{t('Track serial numbers')}</span>
                    </label>
                  )}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {t('Save')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={close}>
                {t('Cancel')}
              </button>
            </div>
          </form>
        );
      }
    );
  };

  // Archive confirmation
  const handleArchiveProduct = (id) => {
    openModal(
      'Archive',
      ({ close }) => (
        <div className="stack">
          <p>{t('Are you sure you want to archive this product? Archived products will no longer appear in the public catalog.')}</p>
          <div className="modal-actions">
            <button 
              className="btn btn-danger"
              onClick={async () => {
                try {
                  await api(`/catalog/products/${id}`, { method: 'DELETE' });
                  await loadData();
                  notice(t('Saved.'));
                  close();
                } catch (err) {
                  notice(err.message, true);
                }
              }}
            >
              {t('Archive')}
            </button>
            <button className="btn btn-secondary" onClick={close}>
              {t('Cancel')}
            </button>
          </div>
        </div>
      )
    );
  };

  return (
    <div className="workspace-subpage">
      <div className="page-top">
        <h1>{t('Products')}</h1>
        <button 
          className="btn btn-primary btn-small"
          onClick={() => handleOpenProductModal()}
        >
          <Plus size={16} />
          <span>{t('Add product')}</span>
        </button>
      </div>

      <form onSubmit={handleSearchSubmit} className="inline-filter-bar mb-4">
        <div className="input-search-wrap filter-search">
          <Search size={16} className="search-icon" />
          <input 
            type="search" 
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder={t('Search products')}
            className="input-field input-search"
          />
        </div>
        <button type="submit" className="btn btn-secondary btn-small">
          <span>{t('Search')}</span>
        </button>
      </form>

      {loading ? (
        <p className="loading-text">{t('Loading…')}</p>
      ) : products.length > 0 ? (
        <>
          <div className="table-card panel">
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 52 }}>{t('Photo')}</th>
                    <th>{t('Products')}</th>
                    <th>{t('SKU')}</th>
                    <th className="numeric">{t('Price')}</th>
                    <th>{t('Available')}</th>
                    <th>{t('Status')}</th>
                    <th>{t('Action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td>
                        {p.image_url ? (
                          <img 
                            src={buildImageUrl(p.image_url, { width: 88, height: 88 })} 
                            alt={p.name}
                            className="product-table-thumb"
                            loading="lazy"
                          />
                        ) : (
                          <div className="product-table-thumb-placeholder" title={t('No image')}>
                            <ImageIcon size={18} />
                          </div>
                        )}
                      </td>
                      <td>
                        <strong>{p.name}</strong>
                        {p.category_name && <div className="muted-small">{p.category_name}</div>}
                      </td>
                      <td className="mono">{p.sku}</td>
                      <td className="numeric">{formatPrice(p.price_minor, false)}</td>
                      <td>{p.available ?? 0}</td>
                      <td>
                        <Badge 
                          status={p.active ? 'completed' : 'cancelled'} 
                          label={t(p.active ? 'Enabled' : 'Disabled')} 
                        />
                      </td>
                      <td>
                        <div className="table-actions">
                          <button 
                            className="btn btn-secondary btn-small"
                            onClick={() => handleOpenProductModal(p)}
                            title={t('Edit')}
                          >
                            <Edit3 size={14} />
                            <span>{t('Edit')}</span>
                          </button>
                          <button 
                            className="btn btn-danger btn-small"
                            onClick={() => handleArchiveProduct(p.id)}
                            title={t('Archive')}
                          >
                            <Archive size={14} />
                            <span>{t('Archive')}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination 
            page={page} 
            total={total} 
            limit={30} 
            onPageChange={handlePageChange} 
          />
        </>
      ) : (
        <EmptyState 
          title="No products found"
          subtitle="Try another search term or add a new product."
          icon={<Layers size={48} />}
        />
      )}
    </div>
  );
}
