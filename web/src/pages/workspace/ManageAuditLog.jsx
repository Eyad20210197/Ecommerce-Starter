import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext.jsx';
import { api } from '../../lib/api.js';
import { formatDate } from '../../lib/formatters.js';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { History, ChevronRight, ChevronLeft } from 'lucide-react';

export function ManageAuditLog({ searchParams, onNavigate }) {
  const { language, t } = useStore();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));

  const loadAudit = useCallback(async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams(searchParams);
      q.set('page', String(page));
      const res = await api(`/admin/audit?${q.toString()}`);
      setEvents(res.events || []);
    } catch (err) {
      console.error('Failed to load audit log', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [searchParams, page]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    const q = new URLSearchParams(searchParams);
    q.set('page', String(newPage));
    onNavigate(`/manage/audit?${q.toString()}`);
  };

  return (
    <div className="workspace-subpage">
      <div className="page-top">
        <h1>{t('Activity history')}</h1>
      </div>

      {loading ? (
        <p className="loading-text">{t('Loading…')}</p>
      ) : events.length > 0 ? (
        <>
          <div className="table-card panel">
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('Date')}</th>
                    <th>{t('Staff')}</th>
                    <th>{t('Event')}</th>
                    <th>{t('Details')}</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(ev => (
                    <tr key={ev.id}>
                      <td className="muted-cell">{formatDate(ev.created_at, language)}</td>
                      <td><strong>{ev.actor_name || t('System')}</strong></td>
                      <td><span className="mono-badge">{t(ev.action)}</span></td>
                      <td>
                        <details className="audit-details">
                          <summary className="audit-summary">{t('Details')}</summary>
                          <pre className="audit-prewrap">
                            {JSON.stringify(ev.details, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Simple Pagination */}
          <div className="pagination-wrap mt-4">
            <button 
              className="pagination-btn"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              {t('Previous')}
            </button>
            <span className="pagination-indicator">{page}</span>
            <button 
              className="pagination-btn"
              disabled={events.length < 100}
              onClick={() => handlePageChange(page + 1)}
            >
              {t('Next')}
            </button>
          </div>
        </>
      ) : (
        <EmptyState 
          title={t('Nothing to show yet.')}
          subtitle={t('All store activities and order updates will appear here.')}
          icon={<History size={48} />}
        />
      )}
    </div>
  );
}
