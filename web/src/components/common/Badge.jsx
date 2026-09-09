import React from 'react';
import { useStore } from '../../context/StoreContext.jsx';

export function Badge({ status, label }) {
  const { t } = useStore();
  const normalizedStatus = String(status || '').toLowerCase().trim();
  
  let displayLabel = label;
  if (!displayLabel) {
    if (normalizedStatus === 'void') {
      displayLabel = t('Cancelled');
    } else {
      displayLabel = t(status);
    }
  }

  return (
    <span className={`status-pill status-${normalizedStatus}`}>
      {displayLabel}
    </span>
  );
}
