import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import {
  ShoppingBag,
  ShoppingCart,
  User,
  LayoutDashboard,
  LogOut,
  Globe,
  Coins,
  Menu,
  X
} from 'lucide-react';
import { SearchBar } from '../common/SearchBar.jsx';

export function Header({ currentPath, searchParams, onNavigate }) {
  const { storeConfig, backendConfig, currency, setCurrency, language, setLanguage, t } = useStore();
  const { user, isStaff, logout } = useAuth();
  const { cartCount } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const brand = storeConfig.brand;

  const supportedCurrencies = storeConfig.i18n.supportedCurrencies || [
    { code: 'USD', label: 'USD ($)' },
    { code: 'EUR', label: 'EUR (€)' },
    { code: 'EGP', label: 'EGP (E£)' },
    { code: 'SAR', label: 'SAR (ر.س)' },
    { code: 'AED', label: 'AED (د.إ)' },
    { code: 'GBP', label: 'GBP (£)' }
  ];

  const availableCurrencies = backendConfig?.currencies && Object.keys(backendConfig.currencies).length > 1
    ? Object.keys(backendConfig.currencies).map(code => {
      const found = supportedCurrencies.find(sc => sc.code === code);
      return found || { code, label: code };
    })
    : supportedCurrencies;

  const currentQ = searchParams?.get('q') || '';
  const currentTag = searchParams?.get('tag') ? `#${searchParams.get('tag')}` : '';
  const initialSearch = currentQ || currentTag;

  const handleNav = (path) => {
    onNavigate(path);
    setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    onNavigate('/');
    setMobileMenuOpen(false);
  };

  const handleHeaderSearch = (searchVal) => {
    if (typeof searchVal === 'object' && searchVal.tag) {
      handleNav(`/?tag=${encodeURIComponent(searchVal.tag)}`);
    } else if (searchVal) {
      const trimmed = String(searchVal).trim();
      if (trimmed.startsWith('#')) {
        handleNav(`/?tag=${encodeURIComponent(trimmed.slice(1).trim())}`);
      } else {
        handleNav(`/?q=${encodeURIComponent(trimmed)}`);
      }
    } else {
      handleNav('/');
    }
  };

  const handleSelectProduct = (product) => {
    handleNav(`/products/${product.id}`);
  };

  const handleSelectTag = (tag) => {
    handleNav(`/?tag=${encodeURIComponent(tag)}`);
  };

  return (
    <header className="site-header">
      {/* Top Utility Bar - Prominent Language & Multi-Currency Switcher */}
      <div className="top-utility-bar">
        <div className="utility-bar-inner">
          <div className="utility-controls">
            {/* Language Switcher */}
            <div className="utility-control lang-control" title={t('Switch language')}>
              <Globe size={14} className="control-icon" />
              <div className="lang-switcher-pills">
                <button
                  type="button"
                  className={`lang-pill ${language === 'en' ? 'active' : ''}`}
                  onClick={() => setLanguage('en')}
                  aria-label="English language"
                >
                  EN
                </button>
                <span className="pill-divider">|</span>
                <button
                  type="button"
                  className={`lang-pill ${language === 'ar' ? 'active' : ''}`}
                  onClick={() => setLanguage('ar')}
                  aria-label="Arabic language"
                >
                  العربية
                </button>
              </div>
            </div>

            {/* Currency Switcher */}
            <div className="utility-control currency-control" title={t('Switch currency')}>
              <Coins size={14} className="control-icon" />
              <select
                aria-label={t('Currency')}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="currency-select-prominent"
              >
                {availableCurrencies.map(curr => (
                  <option key={curr.code} value={curr.code}>
                    {curr.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="header-inner">
        <a
          href="#/"
          className="brand-logo"
          onClick={(e) => { e.preventDefault(); handleNav('/'); }}
        >
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name} className="brand-image" />
          ) : (
            <span className="brand-text">{brand.name}</span>
          )}
        </a>

        {/* Global Search Bar (Desktop) */}
        <div className="header-search-wrap">
          <SearchBar
            initialValue={initialSearch}
            onSearch={handleHeaderSearch}
            onSelectProduct={handleSelectProduct}
            onSelectTag={handleSelectTag}
            placeholder={t('Search products, tags...')}
          />
        </div>

        {/* Desktop Navigation */}
        <nav className="desktop-nav" aria-label="Main Navigation">
          <a
            href="#/"
            className={`nav-link ${currentPath === '/' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); handleNav('/'); }}
          >
            {t('Shop')}
          </a>

          <a
            href="#/cart"
            className={`nav-link cart-link ${currentPath === '/cart' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); handleNav('/cart'); }}
          >
            <ShoppingCart size={18} />
            <span>{t('Cart')}</span>
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </a>

          <a
            href={user ? '#/account' : '#/login'}
            className={`nav-link ${['/account', '/login', '/register'].includes(currentPath) ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); handleNav(user ? '/account' : '/login'); }}
          >
            <User size={18} />
            <span>{t(user ? 'Account' : 'Sign in')}</span>
          </a>

          {isStaff && (
            <a
              href="#/manage/orders"
              className={`nav-link workspace-link ${currentPath.startsWith('/manage') ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); handleNav('/manage/orders'); }}
            >
              <LayoutDashboard size={18} />
              <span>{t('Workspace')}</span>
            </a>
          )}

          {user && (
            <button
              className="signout-btn"
              onClick={handleLogout}
              title={t('Sign out')}
            >
              <LogOut size={16} />
              <span>{t('Sign out')}</span>
            </button>
          )}
        </nav>

        {/* Mobile Header Actions (Cart count + Hamburger) */}
        <div className="mobile-header-actions">
          <a
            href="#/cart"
            className={`mobile-header-cart ${currentPath === '/cart' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); handleNav('/cart'); }}
            aria-label={t('Cart')}
          >
            <ShoppingCart size={22} />
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </a>

          <button
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Search Bar - OUTSIDE the menu drawer */}
      <div className="header-mobile-search">
        <SearchBar
          initialValue={initialSearch}
          onSearch={handleHeaderSearch}
          onSelectProduct={handleSelectProduct}
          onSelectTag={handleSelectTag}
          placeholder={t('Search products, tags...')}
        />
      </div>

      {/* Mobile Drawer Navigation (Only links, search is outside!) */}
      {mobileMenuOpen && (
        <div className="mobile-drawer">
          <nav className="mobile-nav">
            <a
              href="#/"
              className={`mobile-link ${currentPath === '/' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); handleNav('/'); }}
            >
              <ShoppingBag size={18} />
              <span>{t('Shop')}</span>
            </a>

            <a
              href="#/cart"
              className={`mobile-link ${currentPath === '/cart' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); handleNav('/cart'); }}
            >
              <ShoppingCart size={18} />
              <span>{t('Cart')}</span>
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </a>

            <a
              href={user ? '#/account' : '#/login'}
              className={`mobile-link ${['/account', '/login', '/register'].includes(currentPath) ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); handleNav(user ? '/account' : '/login'); }}
            >
              <User size={18} />
              <span>{t(user ? 'Account' : 'Sign in')}</span>
            </a>

            {isStaff && (
              <a
                href="#/manage/orders"
                className={`mobile-link ${currentPath.startsWith('/manage') ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); handleNav('/manage/orders'); }}
              >
                <LayoutDashboard size={18} />
                <span>{t('Workspace')}</span>
              </a>
            )}

            {user && (
              <button className="mobile-signout-btn" onClick={handleLogout}>
                <LogOut size={18} />
                <span>{t('Sign out')}</span>
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
