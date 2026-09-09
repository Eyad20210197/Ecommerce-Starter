import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../context/StoreContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { formatDate } from '../lib/formatters.js';
import { Badge } from '../components/common/Badge.jsx';
import { Pagination } from '../components/common/Pagination.jsx';
import { EmptyState } from '../components/common/EmptyState.jsx';
import { Package, Filter, Eye } from 'lucide-react';

export function OrdersPage({ searchParams, onNavigate }) {
  const { language, formatPrice, t } = useStore();
  const { user, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      onNavigate('/login');
    }
  }, [authLoading, user, onNavigate]);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams(searchParams);
      q.set('page', String(page));
      if (status) q.set('status', status);
      else q.delete('status');

      const res = await api(`/orders?${q.toString()}`);
      setOrders(res.orders || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load orders', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [searchParams, page, status]);

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user, loadOrders]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    const q = new URLSearchParams(searchParams);
    if (status) q.set('status', status);
    else q.delete('status');
    q.delete('page');
    onNavigate(`/orders?${q.toString()}`);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    const q = new URLSearchParams(searchParams);
    q.set('page', String(newPage));
    onNavigate(`/orders?${q.toString()}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (authLoading) {
    return (
      <div className="container-page narrow">
        <p className="loading-text">{t('Loading…')}</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const statuses = [
    { value: '', label: 'All statuses' },
    { value: 'placed', label: 'placed' },
    { value: 'preparing', label: 'preparing' },
    { value: 'dispatched', label: 'dispatched' },
    { value: 'delivered', label: 'delivered' },
    { value: 'completed', label: 'completed' },
    { value: 'cancelled', label: 'cancelled' },
    { value: 'returned', label: 'returned' },
  ];

  return (
    <div className="container-page">
      <div className="page-top">
        <h1>{t('Order history')}</h1>
      </div>

      {/* Filter bar */}
      <form onSubmit={handleFilterSubmit} className="inline-filter-bar mb-4">
        <div className="filter-item">
          <label htmlFor="order-status-filter" className="visually-hidden">{t('Status')}</label>
          <select 
            id="order-status-filter"
            value={status} 
            onChange={(e) => setStatus(e.target.value)}
            className="input-field select-filter"
          >
            {statuses.map(s => (
              <option key={s.value} value={s.value}>{t(s.label)}</option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn btn-secondary btn-small">
          <Filter size={14} />
          <span>{t('Apply')}</span>
        </button>
      </form>

      {loading ? (
        <p className="loading-text">{t('Loading…')}</p>
      ) : orders.length > 0 ? (
        <>
          <div className="table-card panel">
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('Order')}</th>
                    <th>{t('Date')}</th>
                    <th>{t('Status')}</th>
                    <th>{t('Payment')}</th>
                    <th className="numeric">{t('Total')}</th>
                    <th>{t('Action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td>
                        <a 
                          href={`#/orders/${o.id}`}
                          onClick={(e) => { e.preventDefault(); onNavigate(`/orders/${o.id}`); }}
                          className="mono-link"
                        >
                          #{o.number}
                        </a>
                      </td>
                      <td className="muted-cell">{formatDate(o.created_at, language)}</td>
                      <td>
                        <div className="status-badges-cell">
                          <Badge status={o.status} />
                          {o.return_status && <Badge status={o.return_status} />}
                        </div>
                      </td>
                      <td>
                        <Badge 
                          status={o.payment_status} 
                          label={o.payment_method === 'cod' && o.payment_status === 'void' ? t('No payment due') : o.payment_status === 'void' ? t('Cancelled') : null} 
                        />
                      </td>
                      <td className="numeric">
                        <strong>{formatPrice(o.total_minor, false)}</strong>
                      </td>
                      <td>
                        <button 
                          className="btn btn-secondary btn-small"
                          onClick={() => onNavigate(`/orders/${o.id}`)}
                          title={t('Order details')}
                        >
                          <Eye size={14} />
                          <span>{t('Details')}</span>
                        </button>
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
          title="No orders yet"
          subtitle="You haven't placed any orders yet."
          actionLabel="Shop our collection"
          onAction={() => onNavigate('/')}
          icon={<Package size={48} />}
        />
      )}
    </div>
  );
}
