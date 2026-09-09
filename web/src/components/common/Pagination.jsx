import React from 'react';
import { useStore } from '../../context/StoreContext.jsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ page = 1, total = 0, limit = 30, onPageChange }) {
  const { t, language } = useStore();
  const totalPages = Math.ceil(total / limit);

  if (totalPages <= 1) return null;

  const isRtl = language === 'ar';
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <nav className="pagination-wrap" aria-label="Pagination Navigation">
      <button 
        className="pagination-btn" 
        onClick={() => onPageChange(page - 1)} 
        disabled={page <= 1}
        aria-label={t('Previous')}
      >
        <PrevIcon size={16} />
        <span>{t('Previous')}</span>
      </button>

      <span className="pagination-indicator">
        {page} / {totalPages}
      </span>

      <button 
        className="pagination-btn" 
        onClick={() => onPageChange(page + 1)} 
        disabled={page >= totalPages}
        aria-label={t('Next')}
      >
        <span>{t('Next')}</span>
        <NextIcon size={16} />
      </button>
    </nav>
  );
}
