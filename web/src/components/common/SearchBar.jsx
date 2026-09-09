import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../context/StoreContext.jsx';
import { api } from '../../lib/api.js';
import { productName } from '../../lib/formatters.js';
import { buildImageUrl } from '../../lib/imagekit.js';
import { Search, Tag, ShoppingBag, X, ArrowRight, Loader2 } from 'lucide-react';

export function SearchBar({
  initialValue = '',
  onSearch,
  onSelectProduct,
  onSelectTag,
  placeholder,
  className = '',
  compact = false,
  autoFocus = false
}) {
  const { language, formatPrice, t } = useStore();
  const [query, setQuery] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState({ tags: [], products: [] });
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const tagCacheRef = useRef(null);

  // Sync initialValue if it changes externally
  useEffect(() => {
    setQuery(initialValue || '');
  }, [initialValue]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  // Fetch suggestions
  const fetchSuggestions = useCallback(async (searchTerm) => {
    const trimmed = searchTerm.trim().replace(/^#/, '');
    if (!trimmed) {
      setSuggestions({ tags: [], products: [] });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // 1. Text search on catalog
      const textRes = await api(`/catalog/products?q=${encodeURIComponent(trimmed)}&limit=5`);
      
      // Cache or reuse known tags
      if (textRes.tags && textRes.tags.length > 0) {
        tagCacheRef.current = textRes.tags;
      }
      const allTags = tagCacheRef.current || textRes.tags || [];

      // Find matching tags
      const lower = trimmed.toLowerCase();
      const matchedTags = allTags.filter(tg => 
        tg.toLowerCase().includes(lower) || lower.includes(tg.toLowerCase())
      );

      // If matching tags found, also fetch products by that tag to provide complete results
      let tagProducts = [];
      if (matchedTags.length > 0) {
        try {
          const tagRes = await api(`/catalog/products?tag=${encodeURIComponent(matchedTags[0])}&limit=5`);
          tagProducts = tagRes.products || [];
        } catch {
          // Tag fetch fallback
        }
      }

      // Merge and deduplicate products
      const productMap = new Map();
      (textRes.products || []).forEach(p => productMap.set(p.id, p));
      tagProducts.forEach(p => productMap.set(p.id, p));
      const mergedProducts = Array.from(productMap.values()).slice(0, 5);

      setSuggestions({
        tags: matchedTags.slice(0, 6),
        products: mergedProducts
      });
      setIsOpen(true);
    } catch (err) {
      console.error('Failed to fetch search suggestions', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced input change handler
  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setActiveIndex(-1);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!val.trim()) {
      setSuggestions({ tags: [], products: [] });
      setIsOpen(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 220);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions({ tags: [], products: [] });
    setIsOpen(false);
    setActiveIndex(-1);
    if (inputRef.current) inputRef.current.focus();
    if (onSearch) onSearch('');
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    setIsOpen(false);
    setActiveIndex(-1);
    const trimmed = query.trim();
    if (onSearch) {
      onSearch(trimmed);
    }
  };

  const handleSelectTag = (tag) => {
    setIsOpen(false);
    setActiveIndex(-1);
    if (onSelectTag) {
      onSelectTag(tag);
    } else if (onSearch) {
      onSearch({ tag });
    }
  };

  const handleSelectProduct = (product) => {
    setIsOpen(false);
    setActiveIndex(-1);
    if (onSelectProduct) {
      onSelectProduct(product);
    }
  };

  // Keyboard navigation across suggestions
  const allItems = [
    ...suggestions.tags.map(tag => ({ type: 'tag', value: tag })),
    ...suggestions.products.map(p => ({ type: 'product', value: p }))
  ];

  const handleKeyDown = (e) => {
    if (!isOpen || allItems.length === 0) {
      if (e.key === 'Enter') {
        handleSubmit(e);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1 < allItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 >= 0 ? prev - 1 : allItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < allItems.length) {
        const item = allItems[activeIndex];
        if (item.type === 'tag') {
          handleSelectTag(item.value);
        } else if (item.type === 'product') {
          handleSelectProduct(item.value);
        }
      } else {
        handleSubmit(e);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const hasSuggestions = suggestions.tags.length > 0 || suggestions.products.length > 0;
  const showDropdown = isOpen && (hasSuggestions || loading || query.trim().length > 0);

  return (
    <div className={`search-bar-container ${compact ? 'search-compact' : ''} ${className}`} ref={containerRef}>
      <form onSubmit={handleSubmit} className="search-form" role="search">
        <div className="search-input-wrap">
          <Search size={16} className="search-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={handleChange}
            onFocus={() => {
              if (query.trim()) {
                if (hasSuggestions) setIsOpen(true);
                else fetchSuggestions(query);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || t('Search products, tags...')}
            className="search-input-field"
            maxLength={100}
            autoFocus={autoFocus}
            aria-label={t('Search products & tags')}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />

          <div className="search-actions-wrap">
            {loading && <Loader2 size={14} className="search-spinner animate-spin" />}
            {query && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={handleClear}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Autocomplete Dropdown */}
      {showDropdown && (
        <div className="search-popover" role="listbox">
          {loading && !hasSuggestions && (
            <div className="search-popover-loading">
              <Loader2 size={16} className="animate-spin text-muted" />
              <span>{t('Loading…')}</span>
            </div>
          )}

          {!loading && !hasSuggestions && query.trim() && (
            <div className="search-popover-empty">
              <p className="empty-msg">{t('No matches found')}</p>
              <button type="button" className="btn-search-anyway" onClick={handleSubmit}>
                <span>{t('Search for')} &ldquo;{query}&rdquo;</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* Tags Section */}
          {suggestions.tags.length > 0 && (
            <div className="search-section">
              <div className="search-section-header">
                <Tag size={13} />
                <span>{t('Matching tags')}</span>
              </div>
              <div className="search-tags-grid">
                {suggestions.tags.map((tag, idx) => {
                  const isHighlighted = activeIndex === idx;
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`search-tag-chip ${isHighlighted ? 'active' : ''}`}
                      onClick={() => handleSelectTag(tag)}
                      onMouseEnter={() => setActiveIndex(idx)}
                    >
                      <Tag size={12} className="tag-chip-icon" />
                      <span>#{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Products Section */}
          {suggestions.products.length > 0 && (
            <div className="search-section">
              <div className="search-section-header">
                <ShoppingBag size={13} />
                <span>{t('Matching products')}</span>
              </div>
              <div className="search-products-list">
                {suggestions.products.map((product, pIdx) => {
                  const itemIndex = suggestions.tags.length + pIdx;
                  const isHighlighted = activeIndex === itemIndex;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      className={`search-product-item ${isHighlighted ? 'active' : ''}`}
                      onClick={() => handleSelectProduct(product)}
                      onMouseEnter={() => setActiveIndex(itemIndex)}
                    >
                      <div className="search-product-thumb">
                        {product.image_url ? (
                          <img src={buildImageUrl(product.image_url, { width: 80, height: 80 })} alt={product.name} />
                        ) : (
                          <div className="search-product-noimage">
                            <ShoppingBag size={16} />
                          </div>
                        )}
                      </div>

                      <div className="search-product-info">
                        <div className="search-product-name">{productName(product, language)}</div>
                        <div className="search-product-meta">
                          {product.category_name && (
                            <span className="search-product-cat">{product.category_name}</span>
                          )}
                          {product.tags && product.tags.length > 0 && (
                            <span className="search-product-tags">
                              {product.tags.map(t => `#${t}`).join(' ')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="search-product-price">
                        {formatPrice(product.price_minor)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer / Press Enter Action */}
          {hasSuggestions && (
            <div className="search-popover-footer">
              <button type="button" className="search-view-all-btn" onClick={handleSubmit}>
                <span>{t('View all results for')} &ldquo;{query}&rdquo;</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
