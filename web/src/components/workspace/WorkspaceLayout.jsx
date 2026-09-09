import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { BarcodeScannerModal } from '../common/BarcodeScannerModal.jsx';
import { 
  Package, 
  Layers, 
  FolderTree, 
  Boxes, 
  BarChart3, 
  Users, 
  History, 
  Settings, 
  ShieldAlert,
  ScanBarcode
} from 'lucide-react';

export function WorkspaceLayout({ activeTab, onNavigate, children }) {
  const { t } = useStore();
  const { user, loading: authLoading, isOwner, isManager, isWarehouse } = useAuth();
  const [scanModalOpen, setScanModalOpen] = useState(false);

  if (authLoading) {
    return (
      <div className="container-page narrow">
        <p className="loading-text">{t('Loading…')}</p>
      </div>
    );
  }

  if (!user || user.role === 'customer') {
    return (
      <div className="container-page narrow">
        <div className="alert-box alert-error">
          <ShieldAlert size={20} />
          <span>{t('You do not have permission for this action.')}</span>
        </div>
      </div>
    );
  }

  const role = user.role;
  const roleTitle = role === 'owner' ? 'Owner dashboard' : role === 'warehouse' ? 'Warehouse dashboard' : 'Store dashboard';

  const navLinks = [
    { id: 'orders', label: 'Orders', icon: <Package size={18} /> },
    ...(['owner', 'manager'].includes(role) ? [
      { id: 'products', label: 'Products', icon: <Layers size={18} /> },
      { id: 'categories', label: 'Categories', icon: <FolderTree size={18} /> },
      { id: 'reports', label: 'Reports', icon: <BarChart3 size={18} /> },
    ] : []),
    ...(['owner', 'warehouse'].includes(role) ? [
      { id: 'inventory', label: 'Inventory', icon: <Boxes size={18} /> },
    ] : []),
    ...(role === 'owner' ? [
      { id: 'staff', label: 'Employees', icon: <Users size={18} /> },
      { id: 'audit', label: 'Audit log', icon: <History size={18} /> },
      { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
    ] : [])
  ];

  return (
    <div className="container-page workspace-container">
      <div className="workspace-header-title flex-between-center">
        <span className="eyebrow">{t(roleTitle)}</span>
        {(isWarehouse || isOwner || isManager) && (
          <button 
            type="button" 
            className="btn btn-secondary btn-small flex-align-center gap-1"
            onClick={() => setScanModalOpen(true)}
            title={t('Scan any product or serial barcode')}
          >
            <ScanBarcode size={15} />
            <span>{t('Scan product barcode')}</span>
          </button>
        )}
      </div>

      <div className="workspace-layout">
        {/* Workspace Sidebar Nav */}
        <aside className="workspace-sidebar">
          <nav className="workspace-nav-list" aria-label="Workspace Navigation">
            {navLinks.map(link => (
              <a
                key={link.id}
                href={`#/manage/${link.id}`}
                className={`workspace-nav-item ${activeTab === link.id ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(`/manage/${link.id}`);
                }}
              >
                {link.icon}
                <span>{t(link.label)}</span>
              </a>
            ))}
          </nav>
        </aside>

        {/* Workspace Content View */}
        <main className="workspace-content">
          {children}
        </main>
      </div>

      {scanModalOpen && (
        <BarcodeScannerModal
          isOpen={scanModalOpen}
          onClose={() => setScanModalOpen(false)}
          mode="lookup"
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
