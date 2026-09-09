import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext.jsx';
import { api } from '../../lib/api.js';
import { formatMoney } from '../../lib/formatters.js';
import { Filter, BarChart3, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react';

export function ManageReports({ searchParams, onNavigate }) {
  const { language, t } = useStore();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const fromDate = searchParams.get('from') || '';
  const toDate = searchParams.get('to') || '';

  const [fromInput, setFromInput] = useState(fromDate);
  const [toInput, setToInput] = useState(toDate);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams(searchParams);
      const res = await api(`/admin/reports?${q.toString()}`);
      setReport(res);
      if (res.range) {
        setFromInput(res.range.from);
        setToInput(res.range.to);
      }
    } catch (err) {
      console.error('Failed to load reports', err);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    const q = new URLSearchParams();
    if (fromInput) q.set('from', fromInput);
    if (toInput) q.set('to', toInput);
    onNavigate(`/manage/reports?${q.toString()}`);
  };

  if (loading && !report) {
    return (
      <div className="workspace-subpage">
        <p className="loading-text">{t('Loading…')}</p>
      </div>
    );
  }

  const r = report || {
    inventory: { products: 0, on_hand: 0, reserved: 0, retail_value: 0 },
    orders: [],
    payments: [],
    outstanding: [],
    sales: [],
    lowStock: [],
    baseCurrency: 'USD'
  };

  return (
    <div className="workspace-subpage">
      <div className="page-top">
        <h1>{t('Reports')}</h1>
      </div>

      {/* Date Range Filter Bar */}
      <form onSubmit={handleFilterSubmit} className="inline-filter-bar mb-4">
        <div className="date-input-group">
          <label className="field-label-small">{t('From')}:</label>
          <input 
            type="date" 
            required 
            value={fromInput} 
            onChange={e => setFromInput(e.target.value)} 
            className="input-field date-input" 
          />
        </div>

        <div className="date-input-group">
          <label className="field-label-small">{t('To')}:</label>
          <input 
            type="date" 
            required 
            value={toInput} 
            onChange={e => setToInput(e.target.value)} 
            className="input-field date-input" 
          />
        </div>

        <button type="submit" className="btn btn-secondary btn-small">
          <Filter size={14} />
          <span>{t('Apply')}</span>
        </button>
      </form>

      {/* Top Inventory Stats */}
      <div className="stats-grid mb-4">
        <div className="stat-box panel">
          <span className="stat-label">{t('Products')}</span>
          <strong className="stat-value">{r.inventory.products}</strong>
        </div>
        <div className="stat-box panel">
          <span className="stat-label">{t('On hand')}</span>
          <strong className="stat-value">{r.inventory.on_hand}</strong>
        </div>
        <div className="stat-box panel">
          <span className="stat-label">{t('Reserved')}</span>
          <strong className="stat-value">{r.inventory.reserved}</strong>
        </div>
      </div>

      <div className="stack">
        {/* Orders Report */}
        <section className="panel">
          <h2>{t('Orders')}</h2>
          {r.orders.length > 0 ? (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Currency</th>
                    <th>{t('Orders')}</th>
                    <th className="numeric">{t('Total')}</th>
                    <th>{t('cancelled')}</th>
                    <th>{t('completed')}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.orders.map((row, idx) => (
                    <tr key={idx}>
                      <td className="mono"><strong>{row.currency}</strong></td>
                      <td>{row.orders}</td>
                      <td className="numeric">{formatMoney(row.placed_total, row.currency, null, row.currency, language, false)}</td>
                      <td>{row.cancelled}</td>
                      <td>{row.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted-small">{t('Nothing to show yet.')}</p>
          )}
        </section>

        {/* Payments Summary */}
        <section className="panel">
          <h2>{t('Payment')}</h2>
          {r.payments.length > 0 ? (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Currency</th>
                    <th className="numeric">{t('Collected')}</th>
                    <th className="numeric">{t('Refunded')}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.payments.map((row, idx) => (
                    <tr key={idx}>
                      <td className="mono"><strong>{row.currency}</strong></td>
                      <td className="numeric">{formatMoney(row.collected, row.currency, null, row.currency, language, false)}</td>
                      <td className="numeric">{formatMoney(row.refunded, row.currency, null, row.currency, language, false)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted-small">{t('Nothing to show yet.')}</p>
          )}
        </section>

        {/* Outstanding Cash on Delivery */}
        <section className="panel">
          <h2>{t('Outstanding cash on delivery')}</h2>
          {r.outstanding.length > 0 ? (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Currency</th>
                    <th>{t('Orders')}</th>
                    <th className="numeric">{t('Amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.outstanding.map((row, idx) => (
                    <tr key={idx}>
                      <td className="mono"><strong>{row.currency}</strong></td>
                      <td>{row.orders}</td>
                      <td className="numeric">{formatMoney(row.amount, row.currency, null, row.currency, language, false)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted-small">{t('Nothing to show yet.')}</p>
          )}
        </section>

        {/* Sales by Product */}
        <section className="panel">
          <h2>{t('Sales')}</h2>
          {r.sales.length > 0 ? (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('Products')}</th>
                    <th>{t('SKU')}</th>
                    <th>{t('Units')}</th>
                    <th className="numeric">{t('Amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.sales.map((row, idx) => (
                    <tr key={idx}>
                      <td><strong>{row.name}</strong></td>
                      <td className="mono">{row.sku}</td>
                      <td>{row.units}</td>
                      <td className="numeric">{formatMoney(row.revenue, row.currency, null, row.currency, language, false)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted-small">{t('Nothing to show yet.')}</p>
          )}
        </section>

        {/* Low Stock Alerts */}
        {r.lowStock && r.lowStock.length > 0 && (
          <section className="panel">
            <div className="flex-center gap-2 mb-3">
              <AlertTriangle size={20} className="text-danger" />
              <h2>{t('Low stock')}</h2>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('Products')}</th>
                    <th>{t('SKU')}</th>
                    <th>{t('Available')}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.lowStock.map((row, idx) => (
                    <tr key={idx}>
                      <td><strong>{row.name}</strong></td>
                      <td className="mono">{row.sku}</td>
                      <td><span className="stock-danger-badge">{row.available}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Valuation footnote */}
        <div className="panel-footer-note">
          <p className="muted-small">
            {t('Retail inventory value')}: <strong>{formatMoney(r.inventory.retail_value, r.baseCurrency, null, r.baseCurrency, language, false)}</strong>. {t('Inventory value uses retail prices.')}
          </p>
        </div>
      </div>
    </div>
  );
}
