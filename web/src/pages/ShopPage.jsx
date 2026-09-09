import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../context/StoreContext.jsx';
import { api } from '../lib/api.js';
import { ProductCard } from '../components/shop/ProductCard.jsx';
import { Pagination } from '../components/common/Pagination.jsx';
import { EmptyState } from '../components/common/EmptyState.jsx';
import { SearchBar } from '../components/common/SearchBar.jsx';
import { categoryName } from '../lib/formatters.js';
import { starterProducts, starterCategories } from '../config/starterCatalog.js';
import { Search, Tag, X, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

export function ShopPage({ searchParams, onNavigate }) {
  const { language, t } = useStore();
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState({ products: [], tags: [], total: 0, page: 1, limit: 24 });
  const [categories, setCategories] = useState([]);

  // Local filter states
  const categoryId = searchParams.get('category') || '';
  const searchQ = searchParams.get('q') || '';
  const tag = searchParams.get('tag') || '';
  const minPrice = searchParams.get('min') || '';
  const maxPrice = searchParams.get('max') || '';
  const availableOnly = searchParams.get('available') === 'true';
  const sort = searchParams.get('sort') || 'newest';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const [filterForm, setFilterForm] = useState({
    q: searchQ,
    tag: tag,
    min: minPrice ? Number(minPrice) / 100 : '',
    max: maxPrice ? Number(maxPrice) / 100 : '',
    available: availableOnly
  });

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Keep filterForm in sync with URL searchParams
  useEffect(() => {
    setFilterForm({
      q: searchQ,
      tag: tag,
      min: minPrice ? Number(minPrice) / 100 : '',
      max: maxPrice ? Number(maxPrice) / 100 : '',
      available: availableOnly
    });
  }, [searchQ, tag, minPrice, maxPrice, availableOnly]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams(searchParams);
      query.delete('access');
      query.set('limit', '24');
      if (!query.has('page')) query.set('page', '1');

      const rawQ = query.get('q') || '';
      if (rawQ.startsWith('#')) {
        const extractedTag = rawQ.slice(1).trim();
        if (extractedTag) {
          query.delete('q');
          query.set('tag', extractedTag);
        }
      }

      const [catalogRes, catRes] = await Promise.all([
        api(`/catalog/products?${query.toString()}`),
        api('/catalog/categories')
      ]);

      let finalProducts = catalogRes.products || [];
      let finalTotal = catalogRes.total || 0;

      // If text query `q` was provided and user didn't explicitly select another tag filter:
      const activeQ = query.get('q') || '';
      const explicitTag = query.get('tag') || '';
      const allTags = catalogRes.tags || [];

      if (activeQ && !explicitTag) {
        const lowerQ = activeQ.toLowerCase().trim();
        const matchedTags = allTags.filter(tg => 
          tg.toLowerCase().includes(lowerQ) || lowerQ.includes(tg.toLowerCase())
        );

        if (matchedTags.length > 0) {
          try {
            const tagResponses = await Promise.all(
              matchedTags.slice(0, 3).map(tg => {
                const tagQuery = new URLSearchParams(query);
                tagQuery.delete('q');
                tagQuery.set('tag', tg);
                return api(`/catalog/products?${tagQuery.toString()}`);
              })
            );

            const mergedMap = new Map();
            finalProducts.forEach(p => mergedMap.set(p.id, p));
            tagResponses.forEach(res => {
              (res.products || []).forEach(p => mergedMap.set(p.id, p));
            });
            finalProducts = Array.from(mergedMap.values());
            finalTotal = Math.max(finalTotal, mergedMap.size);

            // Respect sort
            const sortMode = query.get('sort') || 'newest';
            if (sortMode === 'price_asc') {
              finalProducts.sort((a, b) => a.price_minor - b.price_minor);
            } else if (sortMode === 'price_desc') {
              finalProducts.sort((a, b) => b.price_minor - a.price_minor);
            } else if (sortMode === 'name') {
              finalProducts.sort((a, b) => a.name.localeCompare(b.name));
            } else {
              finalProducts.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            }
          } catch (err) {
            console.error('Failed to merge tag search results', err);
          }
        }
      }

      setCatalog({
        ...catalogRes,
        products: finalProducts,
        total: finalTotal
      });
      setCategories(catRes.categories || []);
    } catch (err) {
      console.warn('Catalog fetch notice (using starter catalog):', err.message);
      let fallback = [...starterProducts];
      const query = new URLSearchParams(searchParams);
      const qText = (query.get('q') || '').toLowerCase().trim();
      const qTag = (query.get('tag') || '').toLowerCase().trim();
      const qCat = query.get('category') || '';
      const qMin = query.get('min') ? Number(query.get('min')) : null;
      const qMax = query.get('max') ? Number(query.get('max')) : null;
      const qAvail = query.get('available') === 'true';

      if (qCat) fallback = fallback.filter(p => p.category_id === qCat);
      if (qTag) fallback = fallback.filter(p => p.tags.some(t => t.toLowerCase() === qTag));
      if (qText) fallback = fallback.filter(p => p.name.toLowerCase().includes(qText) || p.description.toLowerCase().includes(qText) || p.tags.some(t => t.toLowerCase().includes(qText)));
      if (qMin !== null) fallback = fallback.filter(p => p.price_minor >= qMin);
      if (qMax !== null) fallback = fallback.filter(p => p.price_minor <= qMax);
      if (qAvail) fallback = fallback.filter(p => p.available > 0);

      const sortMode = query.get('sort') || 'newest';
      if (sortMode === 'price_asc') fallback.sort((a, b) => a.price_minor - b.price_minor);
      else if (sortMode === 'price_desc') fallback.sort((a, b) => b.price_minor - a.price_minor);
      else if (sortMode === 'name') fallback.sort((a, b) => a.name.localeCompare(b.name));

      const allTags = Array.from(new Set(starterProducts.flatMap(p => p.tags)));

      setCatalog({
        products: fallback,
        tags: allTags,
        total: fallback.length,
        page: 1,
        limit: 24
      });
      setCategories(starterCategories);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle URL Param changes
  const updateQuery = (updates) => {
    const q = new URLSearchParams(searchParams);
    q.delete('access');
    
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === undefined || val === '' || val === false) {
        q.delete(key);
      } else {
        q.set(key, String(val));
      }
    });

    if (!('page' in updates)) {
      q.delete('page'); // Reset to page 1 on filter change
    }

    onNavigate(`/?${q.toString()}`);
  };

  const handleApplyFilters = (e) => {
    if (e?.preventDefault) e.preventDefault();
    updateQuery({
      q: filterForm.q.trim(),
      tag: filterForm.tag,
      min: filterForm.min !== '' ? Math.round(Number(filterForm.min) * 100) : '',
      max: filterForm.max !== '' ? Math.round(Number(filterForm.max) * 100) : '',
      available: filterForm.available ? 'true' : ''
    });
    setMobileFilterOpen(false);
  };

  const handleCategorySelect = (id) => {
    updateQuery({ category: id });
  };

  const handleSortChange = (e) => {
    updateQuery({ sort: e.target.value });
  };

  const handlePageChange = (newPage) => {
    const q = new URLSearchParams(searchParams);
    q.set('page', String(newPage));
    onNavigate(`/?${q.toString()}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeCategory = categories.find(c => c.id === categoryId);
  const hasActiveFilters = Boolean(searchQ || tag || categoryId || minPrice || maxPrice || availableOnly);

  return (
    <div className="container-page">
      <div className="shop-header">
        <div className="shop-header-title">
          <h1>{t('Collection')}</h1>
          <span className="shop-count">{catalog.total} {t('Products').toLowerCase()}</span>
        </div>

        <div className="shop-header-actions">
          <button 
            className="mobile-filter-btn" 
            onClick={() => setMobileFilterOpen(prev => !prev)}
            aria-label="Toggle filters"
          >
            <SlidersHorizontal size={16} />
            <span>{t('Filters')}</span>
          </button>

          <div className="sort-wrapper">
            <label htmlFor="sort-select" className="visually-hidden">{t('Sort by')}</label>
            <div className="select-with-icon">
              <ArrowUpDown size={14} className="select-icon" />
              <select 
                id="sort-select"
                value={sort} 
                onChange={handleSortChange}
                className="sort-select"
              >
                <option value="newest">{t('Newest')}</option>
                <option value="price_asc">{t('Price: low to high')}</option>
                <option value="price_desc">{t('Price: high to low')}</option>
                <option value="name">{t('Name')}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="shop-layout">
        {/* Sidebar Filters */}
        <aside className={`shop-sidebar ${mobileFilterOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-inner">
            <div className="sidebar-header">
              <h3>{t('Filters')}</h3>
              {mobileFilterOpen && (
                <button className="sidebar-close-btn" onClick={() => setMobileFilterOpen(false)}>×</button>
              )}
            </div>

            <div className="filter-form">
              <div className="filter-group">
                <label className="filter-label">{t('Search products & tags')}</label>
                <SearchBar
                  initialValue={filterForm.q}
                  onSearch={(val) => {
                    if (typeof val === 'object' && val.tag) {
                      updateQuery({ tag: val.tag, q: '' });
                    } else if (val && String(val).startsWith('#')) {
                      updateQuery({ tag: String(val).slice(1).trim(), q: '' });
                    } else {
                      updateQuery({ q: val });
                    }
                    setMobileFilterOpen(false);
                  }}
                  onSelectProduct={(product) => onNavigate(`/products/${product.id}`)}
                  onSelectTag={(tagVal) => {
                    updateQuery({ tag: tagVal, q: '' });
                    setMobileFilterOpen(false);
                  }}
                  placeholder={t('Search products, tags...')}
                />
              </div>

              <div className="filter-group">
                <label className="filter-label">{t('Categories')}</label>
                <div className="category-pill-list">
                  <button 
                    type="button" 
                    className={`category-pill ${!categoryId ? 'active' : ''}`}
                    onClick={() => handleCategorySelect('')}
                  >
                    {t('All products')}
                  </button>
                  {categories.map(c => (
                    <button 
                    key={c.id} 
                    type="button" 
                    className={`category-pill ${categoryId === c.id ? 'active' : ''}`}
                    onClick={() => handleCategorySelect(c.id)}
                  >
                    {categoryName(c, language)}
                  </button>
                  ))}
                </div>
              </div>

              {catalog.tags && catalog.tags.length > 0 && (
                <div className="filter-group">
                  <label className="filter-label">{t('Tags')}</label>
                  <div className="search-tags-grid" style={{ padding: 0 }}>
                    <button
                      type="button"
                      className={`search-tag-chip ${!filterForm.tag ? 'active' : ''}`}
                      onClick={() => setFilterForm(prev => ({ ...prev, tag: '' }))}
                    >
                      <span>{t('Any tag')}</span>
                    </button>
                    {catalog.tags.map(tVal => (
                      <button
                        key={tVal}
                        type="button"
                        className={`search-tag-chip ${filterForm.tag === tVal ? 'active' : ''}`}
                        onClick={() => setFilterForm(prev => ({ ...prev, tag: prev.tag === tVal ? '' : tVal }))}
                      >
                        <Tag size={12} className="tag-chip-icon" />
                        <span>#{tVal}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="filter-group">
                <label className="filter-label">{t('Price')}</label>
                <div className="price-inputs">
                  <input 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    placeholder={t('Minimum price')}
                    value={filterForm.min}
                    onChange={(e) => setFilterForm(prev => ({ ...prev, min: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleApplyFilters(e); }}
                    className="input-field"
                  />
                  <span className="price-dash">-</span>
                  <input 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    placeholder={t('Maximum price')}
                    value={filterForm.max}
                    onChange={(e) => setFilterForm(prev => ({ ...prev, max: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleApplyFilters(e); }}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="filter-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={filterForm.available} 
                    onChange={(e) => setFilterForm(prev => ({ ...prev, available: e.target.checked }))}
                  />
                  <span>{t('In stock only')}</span>
                </label>
              </div>

              <button type="button" onClick={handleApplyFilters} className="btn btn-primary btn-block">
                {t('Apply')}
              </button>
            </div>
          </div>
        </aside>

        {/* Products Grid */}
        <main className="shop-main">
          {/* Active Filter Chips */}
          {hasActiveFilters && (
            <div className="active-filters-bar">
              <span className="active-filters-label">{t('Filters')}:</span>
              {searchQ && (
                <span className="filter-chip">
                  <span>{t('Search')}: &ldquo;{searchQ}&rdquo;</span>
                  <button 
                    type="button" 
                    className="filter-chip-remove" 
                    onClick={() => updateQuery({ q: '' })}
                    aria-label="Remove search filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              {tag && (
                <span className="filter-chip">
                  <Tag size={12} />
                  <span>#{tag}</span>
                  <button 
                    type="button" 
                    className="filter-chip-remove" 
                    onClick={() => updateQuery({ tag: '' })}
                    aria-label="Remove tag filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              {activeCategory && (
                <span className="filter-chip">
                  <span>{categoryName(activeCategory, language)}</span>
                  <button 
                    type="button" 
                    className="filter-chip-remove" 
                    onClick={() => updateQuery({ category: '' })}
                    aria-label="Remove category filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              {(minPrice || maxPrice) && (
                <span className="filter-chip">
                  <span>
                    {minPrice ? `$${Number(minPrice)/100}` : '$0'} - {maxPrice ? `$${Number(maxPrice)/100}` : '∞'}
                  </span>
                  <button 
                    type="button" 
                    className="filter-chip-remove" 
                    onClick={() => updateQuery({ min: '', max: '' })}
                    aria-label="Remove price filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              {availableOnly && (
                <span className="filter-chip">
                  <span>{t('In stock only')}</span>
                  <button 
                    type="button" 
                    className="filter-chip-remove" 
                    onClick={() => updateQuery({ available: '' })}
                    aria-label="Remove in-stock filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              <button 
                type="button" 
                className="btn-clear-all-filters" 
                onClick={() => onNavigate('/')}
              >
                {t('Clear all')}
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-container">
              <p className="loading-text">{t('Loading…')}</p>
            </div>
          ) : catalog.products.length > 0 ? (
            <>
              <div className="product-grid">
                {catalog.products.map(p => (
                  <ProductCard key={p.id} product={p} onNavigate={onNavigate} />
                ))}
              </div>
              <Pagination 
                page={catalog.page} 
                total={catalog.total} 
                limit={catalog.limit || 24} 
                onPageChange={handlePageChange} 
              />
            </>
          ) : (
            <EmptyState 
              title="No products found" 
              subtitle="Try another search or filter."
              actionLabel="All products"
              onAction={() => onNavigate('/')}
            />
          )}
        </main>
      </div>
    </div>
  );
}
