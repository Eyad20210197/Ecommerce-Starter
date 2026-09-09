import React from 'react';
import { useStore } from '../../context/StoreContext.jsx';
import { PackageOpen } from 'lucide-react';

export function EmptyState({ title = 'Nothing to show yet.', subtitle = '', actionLabel = '', onAction = null, icon = null }) {
  const { t } = useStore();

  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {icon || <PackageOpen size={40} />}
      </div>
      <h3 className="empty-state-title">{t(title)}</h3>
      {subtitle && <p className="empty-state-subtitle">{t(subtitle)}</p>}
      {actionLabel && onAction && (
        <button className="btn btn-primary" onClick={onAction}>
          {t(actionLabel)}
        </button>
      )}
    </div>
  );
}
