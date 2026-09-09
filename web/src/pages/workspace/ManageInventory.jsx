import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext.jsx';
import { useModal } from '../../context/ModalContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../lib/api.js';
import { formatDate } from '../../lib/formatters.js';
import { Badge } from '../../components/common/Badge.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { BarcodeScannerModal } from '../../components/common/BarcodeScannerModal.jsx';
import { Boxes, ArrowDownToLine, Sliders, ArrowLeft, History, Hash, ScanBarcode } from 'lucide-react';

export function ManageInventory({ detailProductId, onNavigate }) {
  const { language, storeConfig, t } = useStore();
  const { openModal, closeModal } = useModal();
  const { notice } = useToast();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Detail product states
  const [detailProduct, setDetailProduct] = useState(null);
  const [movements, setMovements] = useState([]);
  const [serials, setSerials] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api('/inventory');
      setProducts(res.products || []);
    } catch (err) {
      console.error('Failed to load inventory', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProductDetail = useCallback(async (id) => {
    try {
      setLoadingDetail(true);
      const [{ product }, moveRes, serRes] = await Promise.all([
        api(`/catalog/products/${id}`),
        api(`/inventory/${id}/movements`),
        api(`/inventory/${id}/serials`)
      ]);
      setDetailProduct(product);
      setMovements(moveRes.movements || []);
      setSerials(serRes.serials || []);
    } catch (err) {
      console.error('Failed to load product inventory detail', err);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (detailProductId) {
      loadProductDetail(detailProductId);
    } else {
      loadInventory();
    }
  }, [detailProductId, loadInventory, loadProductDetail]);

  // Stock Dialog: Receive or Adjust
  const handleStockDialog = (product, kind) => {
    openModal(
      kind === 'receipt' ? 'Receive stock' : 'Adjust stock',
      ({ close }) => {
        const [delta, setDelta] = useState(kind === 'receipt' ? 1 : '');
        const [reason, setReason] = useState('');
        const [serialLines, setSerialLines] = useState('');
        const [submitting, setSubmitting] = useState(false);
        const [error, setError] = useState('');

        const handleSubmit = async (e) => {
          e.preventDefault();
          try {
            setSubmitting(true);
            setError('');

            const serialsList = serialLines
              .split('\n')
              .map(s => s.trim())
              .filter(Boolean);

            await api(`/inventory/${product.id}/adjustments`, {
              method: 'POST',
              body: {
                delta: Number(delta),
                kind,
                reason: reason.trim(),
                serials: serialsList
              }
            });

            if (detailProductId) {
              await loadProductDetail(detailProductId);
            } else {
              await loadInventory();
            }

            notice(t('Saved.'));
            close();
          } catch (err) {
            setError(err.message);
          } finally {
            setSubmitting(false);
          }
        };

        return (
          <form onSubmit={handleSubmit} className="stack">
            {error && <div className="alert-box alert-error">{error}</div>}
            <div className="product-summary-badge">
              <strong>{product.name}</strong> · <span className="mono">{product.sku}</span>
            </div>

            <div className="form-group">
              <label className="field-label">{t('Quantity')}</label>
              <input 
                type="number" 
                required 
                step="1"
                min={kind === 'receipt' ? 1 : -10000} 
                max={10000}
                value={delta}
                onChange={e => setDelta(e.target.value)}
                className="input-field" 
              />
            </div>

            <div className="form-group">
              <label className="field-label">{t('Reason')}</label>
              <div className="quick-presets-row">
                <span className="quick-presets-label">{t('Quick fill')}:</span>
                {(kind === 'receipt' ? [
                  'Supplier shipment received',
                  'Purchase order delivery',
                  'Inventory restock'
                ] : [
                  'Routine warehouse audit count',
                  'Physical recount correction',
                  'Damaged / written-off units'
                ]).map((msg, idx) => (
                  <button 
                    key={idx}
                    type="button" 
                    className="btn-preset-pill"
                    onClick={() => setReason(msg)}
                  >
                    {msg}
                  </button>
                ))}
              </div>
              <textarea 
                required 
                minLength={3} 
                maxLength={300} 
                rows={3}
                value={reason} 
                onChange={e => setReason(e.target.value)} 
                placeholder={kind === 'receipt' ? 'e.g. Supplier PO #1234' : 'e.g. Damaged during handling'}
                className="input-field input-textarea" 
              />
            </div>

            {storeConfig.features.serialNumberTracking && product.serialized && (
              <div className="form-group">
                <label className="field-label">{t('Serial numbers')}</label>
                <textarea 
                  required 
                  rows={4} 
                  value={serialLines} 
                  onChange={e => setSerialLines(e.target.value)} 
                  placeholder="One serial per line"
                  className="input-field input-textarea mono" 
                />
              </div>
            )}

            <div className="modal-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {t('Save')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={close}>
                {t('Cancel')}
              </button>
            </div>
          </form>
        );
      }
    );
  };

  // Render Product Drilldown View
  if (detailProductId) {
    if (loadingDetail) {
      return <p className="loading-text">{t('Loading…')}</p>;
    }

    if (!detailProduct) {
      return (
        <EmptyState 
          title="Product not found"
          actionLabel="Back to inventory"
          onAction={() => onNavigate('/manage/inventory')}
        />
      );
    }

    return (
      <div className="workspace-subpage">
        <div className="mb-3">
          <a 
            href="#/manage/inventory" 
            onClick={(e) => { e.preventDefault(); onNavigate('/manage/inventory'); }}
            className="breadcrumb-link"
          >
            <ArrowLeft size={16} />
            <span>{t('Inventory')}</span>
          </a>
        </div>

        <div className="page-top">
          <div>
            <h1>{detailProduct.name}</h1>
            <p className="muted-small mono">{detailProduct.sku}</p>
          </div>

          <div className="actions">
            <button 
              className="btn btn-primary btn-small"
              onClick={() => handleStockDialog(detailProduct, 'receipt')}
            >
              <ArrowDownToLine size={16} />
              <span>{t('Receive stock')}</span>
            </button>
            <button 
              className="btn btn-secondary btn-small"
              onClick={() => handleStockDialog(detailProduct, 'adjustment')}
            >
              <Sliders size={16} />
              <span>{t('Adjust stock')}</span>
            </button>
          </div>
        </div>

        {/* Stock Stats Grid */}
        <div className="stats-grid mb-4">
          <div className="stat-box panel">
            <span className="stat-label">{t('On hand')}</span>
            <strong className="stat-value">{detailProduct.on_hand}</strong>
          </div>
          <div className="stat-box panel">
            <span className="stat-label">{t('Reserved')}</span>
            <strong className="stat-value">{detailProduct.reserved}</strong>
          </div>
          <div className="stat-box panel">
            <span className="stat-label">{t('Available')}</span>
            <strong className="stat-value">{detailProduct.available}</strong>
          </div>
        </div>

        {/* Movements Table */}
        <div className="panel mb-4">
          <h2>{t('Stock movements')}</h2>
          {movements.length > 0 ? (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('Date')}</th>
                    <th>{t('Action')}</th>
                    <th>{t('On hand')}</th>
                    <th>{t('Reserved')}</th>
                    <th>{t('Reason')}</th>
                    <th>{t('Employee')}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map(m => (
                    <tr key={m.id}>
                      <td className="muted-cell">{formatDate(m.created_at, language)}</td>
                      <td><Badge status={m.kind === 'receipt' ? 'completed' : 'preparing'} label={t(m.kind)} /></td>
                      <td>{m.on_hand_delta > 0 ? `+${m.on_hand_delta}` : m.on_hand_delta}</td>
                      <td>{m.reserved_delta > 0 ? `+${m.reserved_delta}` : m.reserved_delta}</td>
                      <td>{m.reason}</td>
                      <td className="muted-cell">{m.actor_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted-small">{t('Nothing to show yet.')}</p>
          )}
        </div>

        {/* Serial Numbers Table */}
        {storeConfig.features.serialNumberTracking && detailProduct.serialized && (
          <div className="panel">
            <h2>{t('Serial numbers')}</h2>
            {serials.length > 0 ? (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('Serial numbers')}</th>
                      <th>{t('Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serials.map(s => (
                      <tr key={s.id || s.serial}>
                        <td className="mono"><strong>{s.serial}</strong></td>
                        <td><Badge status={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted-small">{t('Nothing to show yet.')}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Render Full Inventory Table
  return (
    <div className="workspace-subpage">
      <div className="page-top flex-between-center">
        <h1>{t('Inventory')}</h1>
        <button 
          type="button" 
          className="btn btn-secondary btn-small flex-align-center gap-1"
          onClick={() => setScannerOpen(true)}
          title={t('Scan any product or serial barcode')}
        >
          <ScanBarcode size={15} />
          <span>{t('Scan product barcode')}</span>
        </button>
      </div>

      {loading ? (
        <p className="loading-text">{t('Loading…')}</p>
      ) : products.length > 0 ? (
        <div className="table-card panel">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('Products')}</th>
                  <th>{t('SKU')}</th>
                  <th>{t('On hand')}</th>
                  <th>{t('Reserved')}</th>
                  <th>{t('Available')}</th>
                  <th>{t('Action')}</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td>
                      <a 
                        href={`#/manage/inventory/${p.id}`}
                        onClick={(e) => { e.preventDefault(); onNavigate(`/manage/inventory/${p.id}`); }}
                        className="strong-link"
                      >
                        {p.name}
                      </a>
                    </td>
                    <td className="mono">{p.sku}</td>
                    <td>{p.on_hand}</td>
                    <td>{p.reserved}</td>
                    <td><strong>{p.available}</strong></td>
                    <td>
                      <button 
                        className="btn btn-secondary btn-small"
                        onClick={() => handleStockDialog(p, 'receipt')}
                      >
                        <ArrowDownToLine size={14} />
                        <span>{t('Receive stock')}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState 
          title="Nothing to show yet."
          subtitle="Add products to your catalog to track stock."
          icon={<Boxes size={48} />}
        />
      )}

      {scannerOpen && (
        <BarcodeScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          mode="lookup"
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
