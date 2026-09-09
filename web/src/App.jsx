import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from './context/StoreContext.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { Header } from './components/layout/Header.jsx';
import { Footer } from './components/layout/Footer.jsx';
import { ShopPage } from './pages/ShopPage.jsx';
import { ProductDetailPage } from './pages/ProductDetailPage.jsx';
import { CartPage } from './pages/CartPage.jsx';
import { CheckoutPage } from './pages/CheckoutPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { AccountPage } from './pages/AccountPage.jsx';
import { OrdersPage } from './pages/OrdersPage.jsx';
import { OrderDetailPage } from './pages/OrderDetailPage.jsx';
import { WorkspaceLayout } from './components/workspace/WorkspaceLayout.jsx';
import { ManageOrders } from './pages/workspace/ManageOrders.jsx';
import { ManageProducts } from './pages/workspace/ManageProducts.jsx';
import { ManageCategories } from './pages/workspace/ManageCategories.jsx';
import { ManageInventory } from './pages/workspace/ManageInventory.jsx';
import { ManageReports } from './pages/workspace/ManageReports.jsx';
import { ManageStaff } from './pages/workspace/ManageStaff.jsx';
import { ManageAuditLog } from './pages/workspace/ManageAuditLog.jsx';
import { ManageSettings } from './pages/workspace/ManageSettings.jsx';
import { EmptyState } from './components/common/EmptyState.jsx';

function parseHash(hash) {
  const clean = hash.replace(/^#/, '') || '/';
  const [pathname, search = ''] = clean.split('?');
  const searchParams = new URLSearchParams(search);
  return { pathname: pathname || '/', searchParams };
}

export function App() {
  const { storeConfig, backendConfig, loading, error, retryConfig, t } = useStore();
  const { user } = useAuth();
  const [{ pathname, searchParams }, setRoute] = useState(() => parseHash(window.location.hash));

  // Sync hash changes
  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((to) => {
    const targetHash = to.startsWith('#') ? to : `#${to}`;
    if (window.location.hash === targetHash) {
      setRoute(parseHash(targetHash));
    } else {
      window.location.hash = targetHash;
    }
  }, []);

  // Set document title
  useEffect(() => {
    const brandName = backendConfig?.name || storeConfig.brand.name;
    document.title = brandName;
  }, [backendConfig, storeConfig]);

  if (loading) {
    return (
      <div className="app-loading-screen">
        <p className="loading-text">{t('Loading…')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-page narrow">
        <div className="panel error-screen">
          <h2>{storeConfig.brand.name}</h2>
          <p className="text-danger">{error.message}</p>
          <button className="btn btn-primary" onClick={retryConfig}>
            {t('Retry')}
          </button>
        </div>
      </div>
    );
  }

  // Render Page Content
  const renderContent = () => {
    // Public pages
    if (['/', '/shop', '/products', '/collection'].includes(pathname)) {
      return <ShopPage searchParams={searchParams} onNavigate={navigate} />;
    }

    if (pathname.startsWith('/products/')) {
      const id = pathname.split('/')[2];
      return <ProductDetailPage productId={id} onNavigate={navigate} />;
    }

    if (pathname === '/cart') {
      return <CartPage onNavigate={navigate} />;
    }

    if (pathname === '/checkout') {
      return <CheckoutPage onNavigate={navigate} />;
    }

    if (pathname === '/login' || pathname === '/signin') {
      return <LoginPage onNavigate={navigate} />;
    }

    if (pathname === '/register' || pathname === '/signup') {
      return <RegisterPage onNavigate={navigate} />;
    }

    if (['/account', '/profile', '/addresses'].includes(pathname)) {
      return <AccountPage onNavigate={navigate} />;
    }

    if (pathname === '/orders') {
      return <OrdersPage searchParams={searchParams} onNavigate={navigate} />;
    }

    if (pathname.startsWith('/orders/')) {
      const id = pathname.split('/')[2];
      return <OrderDetailPage orderId={id} searchParams={searchParams} onNavigate={navigate} />;
    }

    if (pathname.startsWith('/manage/orders/')) {
      const id = pathname.split('/')[3];
      if (id) {
        return <OrderDetailPage orderId={id} searchParams={searchParams} onNavigate={navigate} />;
      }
    }

    // Staff / Admin Workspace routes
    if (pathname.startsWith('/manage')) {
      const parts = pathname.split('/').filter(Boolean);
      const activeTab = parts[1] || 'orders';

      let workspaceBody;
      if (activeTab === 'orders') {
        workspaceBody = <ManageOrders searchParams={searchParams} onNavigate={navigate} />;
      } else if (activeTab === 'products') {
        workspaceBody = <ManageProducts searchParams={searchParams} onNavigate={navigate} />;
      } else if (activeTab === 'categories') {
        workspaceBody = <ManageCategories searchParams={searchParams} onNavigate={navigate} />;
      } else if (activeTab === 'inventory') {
        const detailId = parts[2] || null;
        workspaceBody = <ManageInventory detailProductId={detailId} onNavigate={navigate} />;
      } else if (activeTab === 'reports') {
        workspaceBody = <ManageReports searchParams={searchParams} onNavigate={navigate} />;
      } else if (activeTab === 'staff') {
        workspaceBody = <ManageStaff onNavigate={navigate} />;
      } else if (activeTab === 'audit') {
        workspaceBody = <ManageAuditLog searchParams={searchParams} onNavigate={navigate} />;
      } else if (activeTab === 'settings') {
        workspaceBody = <ManageSettings />;
      } else {
        workspaceBody = <ManageOrders searchParams={searchParams} onNavigate={navigate} />;
      }

      return (
        <WorkspaceLayout activeTab={activeTab} onNavigate={navigate}>
          {workspaceBody}
        </WorkspaceLayout>
      );
    }

    // 404 Fallback
    return (
      <div className="container-page">
        <EmptyState 
          title="Page not found"
          subtitle="The page you requested does not exist."
          actionLabel="Return to shop"
          onAction={() => navigate('/')}
        />
      </div>
    );
  };

  return (
    <div className="app-root">
      <Header currentPath={pathname} searchParams={searchParams} onNavigate={navigate} />
      <main id="main" className="app-main" tabIndex="-1">
        {renderContent()}
      </main>
      <Footer />
    </div>
  );
}
