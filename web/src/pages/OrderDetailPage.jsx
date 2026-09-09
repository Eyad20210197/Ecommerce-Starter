import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../context/StoreContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useModal } from '../context/ModalContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { formatDate, formatMoney } from '../lib/formatters.js';
import { Badge } from '../components/common/Badge.jsx';
import { EmptyState } from '../components/common/EmptyState.jsx';
import { BarcodeScannerModal, playChime } from '../components/common/BarcodeScannerModal.jsx';
import { 
  Printer, 
  Copy, 
  RotateCcw, 
  ExternalLink, 
  Truck, 
  MapPin, 
  Receipt, 
  ArrowLeft,
  Clock,
  ShieldAlert,
  CheckCircle2,
  CreditCard,
  Edit3,
  Send,
  ScanBarcode
} from 'lucide-react';

export function OrderDetailPage({ orderId, searchParams, onNavigate }) {
  const { language, storeConfig, t } = useStore();
  const { user, isStaff, isManager, isWarehouse, isOwner } = useAuth();
  const { openModal, closeModal } = useModal();
  const { notice } = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [paying, setPaying] = useState(false);
  const [verifyingItem, setVerifyingItem] = useState(null);

  // Handle return from payment gateway ?payment=success or ?payment=cancelled
  useEffect(() => {
    const paymentResult = searchParams?.get('payment');
    if (paymentResult === 'success') {
      notice(t('Payment successful! Your order is being processed.'));
    } else if (paymentResult === 'cancelled') {
      notice(t('Payment was cancelled. You can retry payment below.'), true);
    }
  }, [searchParams, notice, t]);

  // Handle guest capability access link parameter ?access=xyz
  useEffect(() => {
    const access = searchParams?.get('access');
    if (access && /^[A-Za-z0-9_-]{43}$/.test(access)) {
      sessionStorage.setItem(`order:${orderId}`, access);
    }
  }, [orderId, searchParams]);

  const getOrderHeaders = useCallback(() => {
    const access = sessionStorage.getItem(`order:${orderId}`);
    return access ? { 'X-Order-Token': access } : {};
  }, [orderId]);

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api(`/orders/${orderId}`, { headers: getOrderHeaders() });
      setOrder(res.order);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load order.');
    } finally {
      setLoading(false);
    }
  }, [orderId, getOrderHeaders]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  // Page-level hands-free hardware barcode scanner listener
  useEffect(() => {
    if (!order || order.status !== 'placed' || verifyingItem) return;
    const canVerify = isStaff || isWarehouse || isManager || isOwner;
    if (!canVerify) return;

    let buffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = async (e) => {
      // Ignore if operator is currently typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
      }

      const now = Date.now();
      const delta = now - lastKeyTime;
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.length >= 2 && delta < 150) {
          e.preventDefault();
          const scanned = buffer.trim();
          buffer = '';

          // Find matching item in this order
          const matchItem = order.items?.find(i => 
            i.sku.toLowerCase() === scanned.toLowerCase() ||
            (i.serials && i.serials.some(s => s.toLowerCase() === scanned.toLowerCase()))
          );

          if (matchItem) {
            try {
              await api(`/orders/${orderId}/verify-item`, {
                method: 'POST',
                body: { item_id: matchItem.id, barcode: scanned }
              });
              playChime('success');
              notice(`${t('Verified')}: ${matchItem.name} (${matchItem.sku})`);
              await loadOrder();
            } catch (err) {
              playChime('error');
              notice(err.message || t('Verification failed'), true);
            }
          } else {
            playChime('error');
            notice(`${t('No matching item in this order for SKU')}: "${scanned}"`, true);
          }
        }
        return;
      }

      if (e.key.length === 1) {
        if (delta > 80 && buffer.length > 0) {
          buffer = '';
        }
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [order, verifyingItem, isStaff, isWarehouse, isManager, isOwner, orderId, loadOrder, notice, t]);

  // Copy private order link for guests
  const handleCopyLink = async () => {
    const access = sessionStorage.getItem(`order:${orderId}`);
    if (!access) {
      notice('The private guest access link is only available in the browser that placed the order.', true);
      return;
    }
    const link = `${window.location.origin}/#/orders/${orderId}?access=${encodeURIComponent(access)}`;
    try {
      await navigator.clipboard.writeText(link);
      notice(t('Copied.'));
    } catch {
      notice('Failed to copy to clipboard', true);
    }
  };

  // Print Invoice
  const handlePrintInvoice = async () => {
    const view = window.open('about:blank', '_blank');
    if (view) view.opener = null;

    try {
      const response = await api(`/orders/${orderId}/invoice`, {
        headers: getOrderHeaders(),
        raw: true
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (view) {
        view.location = url;
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${order?.invoice_number || 'invoice'}.html`;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      view?.close();
      notice(err.message || 'Failed to generate invoice', true);
    }
  };

  // Customer Return Request Dialog
  const handleRequestReturn = () => {
    openModal(
      'Request a return',
      ({ close }) => {
        const [reason, setReason] = useState('');
        const [submitting, setSubmitting] = useState(false);
        const [error, setError] = useState('');

        const handleSubmit = async (e) => {
          e.preventDefault();
          try {
            setSubmitting(true);
            setError('');
            await api(`/orders/${orderId}/returns`, {
              method: 'POST',
              body: { reason: reason.trim() },
              headers: getOrderHeaders()
            });
            await loadOrder();
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
            <p className="muted-small">{t('Full-order returns only.')} {t('Refund includes shipping and tax.')}</p>
            <div className="form-group">
              <label className="field-label">{t('Return reason')}</label>
              <textarea 
                required 
                minLength={5} 
                maxLength={500} 
                rows={4}
                value={reason} 
                onChange={e => setReason(e.target.value)}
                placeholder={t('Please describe why you would like to return this order.')}
                className="input-field input-textarea" 
              />
            </div>
            <div className="modal-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {t('Submit request')}
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

  // Staff Transitions
  const handleTransition = (newStatus) => {
    openModal(
      t(newStatus),
      ({ close }) => {
        const [note, setNote] = useState('');
        const [submitting, setSubmitting] = useState(false);
        const [error, setError] = useState('');

        const presets = {
          preparing: [
            'Order packed and verified.',
            'In staging queue for courier pickup.',
            'Items assembled and boxed.'
          ],
          dispatched: [
            'Handed over to courier driver.',
            'Dispatched via delivery carrier.',
            'Out for delivery with courier.'
          ],
          delivered: [
            'Delivered to customer doorstep.',
            'Handed directly to recipient.',
            'Delivered and signed for.'
          ],
          completed: [
            'Order fulfilled and confirmed.',
            'Customer accepted delivery.',
            'Completed successfully.'
          ],
          cancelled: [
            'Cancelled per customer request.',
            'Customer unreachable after multiple attempts.',
            'Item unavailable / out of stock.'
          ]
        }[newStatus] || [];

        const handleConfirm = async (e) => {
          e.preventDefault();
          try {
            setSubmitting(true);
            setError('');
            await api(`/orders/${orderId}/status`, {
              method: 'POST',
              body: { status: newStatus, note: note.trim() },
              headers: getOrderHeaders()
            });
            await loadOrder();
            notice(t('Saved.'));
            close();
          } catch (err) {
            setError(err.message);
          } finally {
            setSubmitting(false);
          }
        };

        return (
          <form onSubmit={handleConfirm} className="stack">
            {error && <div className="alert-box alert-error">{error}</div>}
            <div className="form-group">
              <label className="field-label">{t('Note')}</label>
              {presets.length > 0 && (
                <div className="quick-presets-row">
                  <span className="quick-presets-label">{t('Quick fill')}:</span>
                  {presets.map((msg, idx) => (
                    <button 
                      key={idx}
                      type="button" 
                      className="btn-preset-pill"
                      onClick={() => setNote(msg)}
                    >
                      {msg}
                    </button>
                  ))}
                </div>
              )}
              <textarea 
                maxLength={300} 
                rows={3} 
                value={note} 
                onChange={e => setNote(e.target.value)} 
                placeholder={t('Add an operational note or select a quick response above…')}
                className="input-field input-textarea" 
              />
            </div>
            <div className="modal-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {t(newStatus)}
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

  // Staff Cash Collection
  const handleCollectCash = () => {
    openModal(
      'Record cash collection',
      ({ close }) => {
        const [reference, setReference] = useState('');
        const [submitting, setSubmitting] = useState(false);
        const [error, setError] = useState('');

        const cashPresets = [
          'Cash collected on delivery',
          'COD Receipt #',
          'Courier delivery voucher #'
        ];

        const handleConfirm = async (e) => {
          e.preventDefault();
          try {
            setSubmitting(true);
            setError('');
            await api(`/orders/${orderId}/collect`, {
              method: 'POST',
              body: { reference: reference.trim() }
            });
            await loadOrder();
            notice(t('Saved.'));
            close();
          } catch (err) {
            setError(err.message);
          } finally {
            setSubmitting(false);
          }
        };

        return (
          <form onSubmit={handleConfirm} className="stack">
            {error && <div className="alert-box alert-error">{error}</div>}
            <div className="form-group">
              <label className="field-label">{t('Reference')}</label>
              <div className="quick-presets-row">
                <span className="quick-presets-label">{t('Quick fill')}:</span>
                {cashPresets.map((msg, idx) => (
                  <button 
                    key={idx}
                    type="button" 
                    className="btn-preset-pill"
                    onClick={() => setReference(msg)}
                  >
                    {msg}
                  </button>
                ))}
              </div>
              <input 
                type="text" 
                required 
                minLength={3} 
                maxLength={120} 
                value={reference} 
                onChange={e => setReference(e.target.value)} 
                placeholder="Receipt / Voucher #"
                className="input-field" 
              />
            </div>
            <div className="modal-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {t('Record cash collection')}
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

  // Owner Refund
  const handleRefund = () => {
    openModal(
      'Refund payment',
      ({ close }) => {
        const [reference, setReference] = useState('');
        const [submitting, setSubmitting] = useState(false);
        const [error, setError] = useState('');

        const refundPresets = [
          'Cash refund issued to customer',
          'Bank transfer refund reference #',
          'Customer payout voucher #'
        ];

        const handleConfirm = async (e) => {
          e.preventDefault();
          try {
            setSubmitting(true);
            setError('');
            await api(`/orders/${orderId}/refund`, {
              method: 'POST',
              body: { reference: reference.trim() }
            });
            await loadOrder();
            notice(t('Saved.'));
            close();
          } catch (err) {
            setError(err.message);
          } finally {
            setSubmitting(false);
          }
        };

        return (
          <form onSubmit={handleConfirm} className="stack">
            {error && <div className="alert-box alert-error">{error}</div>}
            <div className="form-group">
              <label className="field-label">{t('Reference')}</label>
              <div className="quick-presets-row">
                <span className="quick-presets-label">{t('Quick fill')}:</span>
                {refundPresets.map((msg, idx) => (
                  <button 
                    key={idx}
                    type="button" 
                    className="btn-preset-pill"
                    onClick={() => setReference(msg)}
                  >
                    {msg}
                  </button>
                ))}
              </div>
              <input 
                type="text" 
                required 
                minLength={3} 
                maxLength={120} 
                value={reference} 
                onChange={e => setReference(e.target.value)} 
                className="input-field" 
              />
            </div>
            <div className="modal-actions">
              <button type="submit" className="btn btn-danger" disabled={submitting}>
                {t('Refund payment')}
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

  // Manager Approve/Reject Return
  const handleReturnDecision = (decisionStatus) => {
    openModal(
      decisionStatus === 'approved' ? 'Approve return' : 'Reject return',
      ({ close }) => {
        const [note, setNote] = useState('');
        const [submitting, setSubmitting] = useState(false);
        const [error, setError] = useState('');

        const decisionPresets = decisionStatus === 'approved' ? [
          'Approved: Within 14-day return window.',
          'Approved: Item unopened & pristine condition.',
          'Approved: Return authorized for inspection.'
        ] : [
          'Rejected: Exceeded return policy window.',
          'Rejected: Item altered or damaged by customer.',
          'Rejected: Proof of purchase missing.'
        ];

        const handleConfirm = async (e) => {
          e.preventDefault();
          try {
            setSubmitting(true);
            setError('');
            await api(`/orders/${orderId}/returns/status`, {
              method: 'POST',
              body: { status: decisionStatus, note: note.trim() }
            });
            await loadOrder();
            notice(t('Saved.'));
            close();
          } catch (err) {
            setError(err.message);
          } finally {
            setSubmitting(false);
          }
        };

        return (
          <form onSubmit={handleConfirm} className="stack">
            {error && <div className="alert-box alert-error">{error}</div>}
            <div className="form-group">
              <label className="field-label">{t('Note')}</label>
              <div className="quick-presets-row">
                <span className="quick-presets-label">{t('Quick fill')}:</span>
                {decisionPresets.map((msg, idx) => (
                  <button 
                    key={idx}
                    type="button" 
                    className="btn-preset-pill"
                    onClick={() => setNote(msg)}
                  >
                    {msg}
                  </button>
                ))}
              </div>
              <textarea 
                required 
                minLength={3} 
                maxLength={500} 
                rows={3} 
                value={note} 
                onChange={e => setNote(e.target.value)} 
                className="input-field input-textarea" 
              />
            </div>
            <div className="modal-actions">
              <button type="submit" className={`btn ${decisionStatus === 'approved' ? 'btn-primary' : 'btn-danger'}`} disabled={submitting}>
                {decisionStatus === 'approved' ? t('Approve return') : t('Reject return')}
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

  // Warehouse Receive Return
  const handleReceiveReturn = () => {
    openModal(
      'Receive return',
      ({ close }) => {
        const [note, setNote] = useState('');
        const [restock, setRestock] = useState(true);
        const [serials, setSerials] = useState('');
        const [submitting, setSubmitting] = useState(false);
        const [error, setError] = useState('');

        const receivePresets = [
          'Package in good condition — able to restock.',
          'Inspected & sealed — returned to active stock.',
          'Opened box, contents intact — restocked.',
          'Defective unit — quarantined for vendor return.'
        ];

        const hasSerialized = order.items.some(i => i.serialized);

        const handleConfirm = async (e) => {
          e.preventDefault();
          try {
            setSubmitting(true);
            setError('');
            await api(`/orders/${orderId}/returns/status`, {
              method: 'POST',
              body: {
                status: 'received',
                note: note.trim(),
                restock,
                serials: serials.split('\n').map(s => s.trim()).filter(Boolean)
              }
            });
            await loadOrder();
            notice(t('Saved.'));
            close();
          } catch (err) {
            setError(err.message);
          } finally {
            setSubmitting(false);
          }
        };

        return (
          <form onSubmit={handleConfirm} className="stack">
            {error && <div className="alert-box alert-error">{error}</div>}
            <div className="form-group">
              <label className="field-label">{t('Note')}</label>
              <div className="quick-presets-row">
                <span className="quick-presets-label">{t('Quick fill')}:</span>
                {receivePresets.map((msg, idx) => (
                  <button 
                    key={idx}
                    type="button" 
                    className="btn-preset-pill"
                    onClick={() => setNote(msg)}
                  >
                    {msg}
                  </button>
                ))}
              </div>
              <textarea 
                required 
                minLength={3} 
                maxLength={500} 
                rows={3} 
                value={note} 
                onChange={e => setNote(e.target.value)} 
                className="input-field input-textarea" 
              />
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={restock} 
                  onChange={e => setRestock(e.target.checked)} 
                />
                <span>{t('Restock after inspection')}</span>
              </label>
            </div>
            {hasSerialized && (
              <div className="form-group">
                <label className="field-label">{t('Serial numbers')}</label>
                <textarea 
                  required 
                  rows={4} 
                  value={serials} 
                  onChange={e => setSerials(e.target.value)} 
                  placeholder="One serial per line"
                  className="input-field input-textarea mono" 
                />
              </div>
            )}
            <div className="modal-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {t('Receive return')}
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

  // Staff Reset Item Verification
  const handleResetVerification = async (itemId) => {
    try {
      setLoading(true);
      await api(`/orders/${orderId}/verify-item/reset`, {
        method: 'POST',
        body: { item_id: itemId, itemId },
        headers: getOrderHeaders()
      });
      await loadOrder();
      notice(t('Item verification reset.'));
    } catch (err) {
      notice(err.message || 'Failed to reset verification', true);
    } finally {
      setLoading(false);
    }
  };

  // Customer Online Payment
  const handleProceedToPayment = async () => {
    try {
      setPaying(true);
      const res = await api(`/orders/${orderId}/payment`, {
        method: 'POST',
        headers: getOrderHeaders()
      });
      if (res?.url) {
        window.location.href = res.url;
      } else {
        throw new Error('Payment gateway did not return a checkout URL.');
      }
    } catch (err) {
      notice(err.message || 'Payment initiation failed', true);
    } finally {
      setPaying(false);
    }
  };

  // Staff Create Shipment via Integration
  const handleCreateShipment = async () => {
    try {
      setLoading(true);
      await api(`/orders/${orderId}/shipment`, {
        method: 'POST'
      });
      notice(t('Shipment created successfully.'));
      await loadOrder();
    } catch (err) {
      notice(err.message || 'Failed to create shipment', true);
    } finally {
      setLoading(false);
    }
  };

  // Staff Update Tracking Reference / URL
  const handleEditShipment = () => {
    openModal(
      'Update shipment tracking',
      ({ close }) => {
        const [ref, setRef] = useState(order?.shipping_reference || '');
        const [url, setUrl] = useState(order?.tracking_url || '');
        const [submitting, setSubmitting] = useState(false);
        const [error, setError] = useState('');

        const handleSave = async (e) => {
          e.preventDefault();
          try {
            setSubmitting(true);
            setError('');
            await api(`/orders/${orderId}/shipment`, {
              method: 'PATCH',
              body: {
                reference: ref.trim(),
                tracking_url: url.trim() || ''
              }
            });
            await loadOrder();
            notice(t('Saved.'));
            close();
          } catch (err) {
            setError(err.message);
          } finally {
            setSubmitting(false);
          }
        };

        return (
          <form onSubmit={handleSave} className="stack">
            {error && <div className="alert-box alert-error">{error}</div>}
            <div className="form-group">
              <label className="field-label">{t('Shipment reference')} *</label>
              <input 
                type="text" 
                required 
                maxLength={120} 
                value={ref} 
                onChange={e => setRef(e.target.value)} 
                placeholder="e.g. TRACK-987654" 
                className="input-field" 
              />
            </div>
            <div className="form-group">
              <label className="field-label">{t('Tracking URL (HTTPS)')}</label>
              <input 
                type="url" 
                value={url} 
                onChange={e => setUrl(e.target.value)} 
                placeholder="https://track.carrier.com/..." 
                className="input-field" 
              />
            </div>
            <div className="modal-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {t('Save tracking')}
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

  if (loading) {
    return (
      <div className="container-page narrow">
        <p className="loading-text">{t('Loading…')}</p>
      </div>
    );
  }

  if (errorMsg || !order) {
    return (
      <div className="container-page">
        <EmptyState 
          title="Order not found"
          subtitle={errorMsg || "We couldn't retrieve this order."}
          actionLabel="Back to shop"
          onAction={() => onNavigate('/')}
        />
      </div>
    );
  }

  const role = user?.role;
  const o = order;
  const address = o.address || {};
  const contact = o.contact || {};
  const isGuest = !o.user_id;
  const allItemsVerified = Boolean(o.items && o.items.length > 0 && o.items.every(i => i.verified));

  return (
    <div className="container-page">
      {/* Navigation Top */}
      <div className="order-nav-row">
        <a 
          href={isStaff ? '#/manage/orders' : '#/orders'}
          onClick={(e) => { e.preventDefault(); onNavigate(isStaff ? '/manage/orders' : '/orders'); }}
          className="breadcrumb-link"
        >
          <ArrowLeft size={16} />
          <span>{t(isStaff ? 'Workspace' : 'Back to orders')}</span>
        </a>
      </div>

      {/* Top Header Card */}
      <div className="page-top order-header-card">
        <div>
          <h1>{t('Order')} #{o.number}</h1>
          <p className="muted-small mt-2">{formatDate(o.created_at, language)}</p>
        </div>

        <div className="order-top-actions">
          <Badge status={o.status} />
          {!isStaff && ['placed', 'preparing'].includes(o.status) && o.payment_status !== 'paid' && (
            <button 
              type="button" 
              className="btn btn-danger btn-small"
              onClick={() => handleTransition('cancelled')}
            >
              {t('Cancel order')}
            </button>
          )}
          <button 
            type="button" 
            className="btn btn-secondary btn-small"
            onClick={handlePrintInvoice}
          >
            <Printer size={16} />
            <span>{t('Print invoice')}</span>
          </button>
        </div>
      </div>

      {/* Staff Action Buttons Toolbar */}
      {isStaff && (
        <div className="panel staff-actions-panel mb-4">
          <span className="staff-actions-title">{t('Action')}:</span>
          <div className="actions">
            {['placed', 'preparing'].includes(o.status) && o.payment_status !== 'paid' && role !== 'warehouse' && (
              <button className="btn btn-danger btn-small" onClick={() => handleTransition('cancelled')}>
                {t('Cancel order')}
              </button>
            )}

            {isStaff && o.status === 'placed' && (
              <button 
                className="btn btn-primary btn-small" 
                disabled={!allItemsVerified}
                title={!allItemsVerified ? t('All items must be barcode verified before preparing this order') : ''}
                onClick={() => handleTransition('preparing')}
              >
                {t('Prepare')}
              </button>
            )}

            {isStaff && o.status === 'placed' && !allItemsVerified && (
              <span className="badge badge-warning flex-align-center gap-1" title={t('Match item barcodes against expected SKUs')}>
                <ShieldAlert size={14} />
                <span>{t('Barcode verification required')}</span>
              </span>
            )}

            {isStaff && o.status === 'preparing' && (
              <button className="btn btn-primary btn-small" onClick={() => handleTransition('dispatched')}>
                {t('Dispatch')}
              </button>
            )}

            {isManager && o.status === 'dispatched' && (
              <button className="btn btn-primary btn-small" onClick={() => handleTransition('delivered')}>
                {t('Mark delivered')}
              </button>
            )}

            {isManager && o.status === 'delivered' && o.payment_method === 'cod' && o.payment_status === 'pending' && (
              <button className="btn btn-primary btn-small" onClick={handleCollectCash}>
                {t('Record cash collection')}
              </button>
            )}

            {isManager && o.status === 'delivered' && o.payment_status === 'paid' && (
              <button className="btn btn-primary btn-small" onClick={() => handleTransition('completed')}>
                {t('Complete')}
              </button>
            )}

            {isOwner && o.payment_status === 'paid' && ['placed', 'preparing', 'returned'].includes(o.status) && (
              <button className="btn btn-danger btn-small" onClick={handleRefund}>
                {t('Refund payment')}
              </button>
            )}

            {isManager && o.return?.status === 'requested' && (
              <>
                <button className="btn btn-primary btn-small" onClick={() => handleReturnDecision('approved')}>
                  {t('Approve return')}
                </button>
                <button className="btn btn-danger btn-small" onClick={() => handleReturnDecision('rejected')}>
                  {t('Reject return')}
                </button>
              </>
            )}

            {isWarehouse && o.return?.status === 'approved' && (
              <button className="btn btn-primary btn-small" onClick={handleReceiveReturn}>
                {t('Receive return')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Guest Link Copy Button */}
      {isGuest && (
        <div className="guest-access-banner mb-4">
          <button 
            type="button" 
            className="btn btn-secondary btn-small"
            onClick={handleCopyLink}
          >
            <Copy size={16} />
            <span>{t('Copy private order link')}</span>
          </button>
        </div>
      )}

      {/* Items Table */}
      <div className="table-card panel mb-4">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('Products')}</th>
                <th>{t('Quantity')}</th>
                <th>{t('Verification')}</th>
                <th className="numeric">{t('Price')}</th>
                <th className="numeric">{t('Total')}</th>
              </tr>
            </thead>
            <tbody>
              {o.items.map(i => (
                <tr key={i.id || i.product_id}>
                  <td>
                    <strong>{i.name}</strong>
                    <div className="muted-small mt-1">
                      <span>{t('SKU')}: {i.sku}</span>
                      {i.serials && i.serials.length > 0 && (
                        <div className="serials-list mono">
                          {t('Serial numbers')}: {i.serials.join(', ')}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>{i.quantity}</td>
                  <td>
                    {i.verified ? (
                      <div className="flex-align-center gap-2">
                        <span className="badge badge-success flex-align-center gap-1" title={i.verified_at ? `Verified: ${formatDate(i.verified_at, language)}` : 'Verified'}>
                          <CheckCircle2 size={13} />
                          <span>{t('Verified')}</span>
                        </span>
                        {isStaff && ['placed', 'preparing'].includes(o.status) && (
                          <button 
                            type="button" 
                            className="btn-icon-subtle" 
                            title={t('Reset verification')}
                            onClick={() => handleResetVerification(i.id)}
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex-align-center gap-2">
                        <span className="badge badge-warning">{t('Unverified')}</span>
                        {isStaff && ['placed', 'preparing'].includes(o.status) && (
                          <button 
                            type="button" 
                            className="btn btn-primary btn-small flex-align-center gap-1"
                            onClick={() => setVerifyingItem(i)}
                          >
                            <ScanBarcode size={13} />
                            <span>{t('Verify item')}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="numeric">{formatMoney(i.unit_price_minor, o.currency, null, o.currency, language, false)}</td>
                  <td className="numeric">
                    <strong>{formatMoney(i.unit_price_minor * i.quantity, o.currency, null, o.currency, language, false)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Column Layout: Delivery & Summary */}
      <div className="order-grid-two mb-4">
        {/* Delivery Address & Contact */}
        <section className="panel">
          <h2>{t('Delivery address')}</h2>
          <p className="address-display">
            <strong>{address.name}</strong><br />
            {address.line1} {address.line2 && `(${address.line2})`}<br />
            {address.city}, {address.region} {address.postalCode}<br />
            {address.country}<br />
            {address.phone}
          </p>
          <hr className="divider" />
          <p className="muted-small">{contact.email}</p>
        </section>

        {/* Order Pricing Breakdown */}
        <section className="panel">
          <h2>{t('Order summary')}</h2>
          <div className="summary-rows">
            <div className="summary-row">
              <span>{t('Subtotal')}</span>
              <strong>{formatMoney(o.subtotal_minor, o.currency, null, o.currency, language, false)}</strong>
            </div>
            <div className="summary-row">
              <span>{t('Shipping')}</span>
              <strong>{formatMoney(o.shipping_minor, o.currency, null, o.currency, language, false)}</strong>
            </div>
            <div className="summary-row">
              <span>{t('Tax')}</span>
              <strong>{formatMoney(o.tax_minor, o.currency, null, o.currency, language, false)}</strong>
            </div>
            <div className="summary-row total-row">
              <span>{t('Total')}</span>
              <strong>{formatMoney(o.total_minor, o.currency, null, o.currency, language, false)}</strong>
            </div>
          </div>
          <hr className="divider" />
          <div className="payment-status-row">
            <span>{o.payment_method === 'cod' ? t('Cash on delivery') : t('Online payment')}</span>
            <Badge 
              status={o.payment_status} 
              label={o.payment_method === 'cod' && o.payment_status === 'void' ? t('No payment due') : o.payment_status === 'void' ? t('Cancelled') : null} 
            />
          </div>

          {o.payment_method === 'stripe' && o.payment_status === 'pending' && o.status === 'placed' && (
            <div className="mt-3">
              <button 
                type="button" 
                className="btn btn-primary w-100" 
                onClick={handleProceedToPayment}
                disabled={paying}
              >
                <CreditCard size={16} />
                <span>{paying ? t('Loading…') : t('Proceed to payment')}</span>
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Order Notes */}
      {o.notes && (
        <section className="panel mb-4">
          <h4>{t('Order notes')}</h4>
          <p className="order-notes-quote">{o.notes}</p>
        </section>
      )}

      {/* Shipment Reference & Tracking */}
      {(o.shipping_reference || (isStaff && ['preparing', 'dispatched', 'delivered'].includes(o.status))) && (
        <section className="panel mb-4">
          <div className="panel-title-row">
            <div className="flex-center gap-2">
              <Truck size={20} />
              <h2>{t('Shipment')}</h2>
            </div>
            <div className="flex-center gap-2">
              {isStaff && (
                <>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-small"
                    onClick={handleEditShipment}
                  >
                    <Edit3 size={14} />
                    <span>{t('Update tracking')}</span>
                  </button>
                  {['preparing', 'dispatched'].includes(o.status) && (
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-small"
                      onClick={handleCreateShipment}
                    >
                      <Send size={14} />
                      <span>{t('Carrier dispatch')}</span>
                    </button>
                  )}
                </>
              )}
              {o.tracking_url && (
                <a 
                  href={o.tracking_url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn btn-secondary btn-small"
                >
                  <span>{t('View tracking')}</span>
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
          {o.shipping_reference ? (
            <p><strong>{t('Shipment reference')}:</strong> {o.shipping_reference}</p>
          ) : (
            <p className="muted-small">{t('No carrier tracking number attached yet.')}</p>
          )}
        </section>
      )}

      {/* Return Request Banner */}
      {storeConfig.features.orderReturns && !o.return && ['delivered', 'completed'].includes(o.status) && (
        <div className="panel return-callout-panel mb-4">
          <div className="return-callout-text">
            <h4>{t('Need to return this order?')}</h4>
            <p className="muted-small">{t('Full-order returns only.')} {t('Refund includes shipping and tax.')}</p>
          </div>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={handleRequestReturn}
          >
            <RotateCcw size={16} />
            <span>{t('Request a return')}</span>
          </button>
        </div>
      )}

      {/* Return Status Card */}
      {o.return && (
        <section className="panel return-info-panel mb-4">
          <div className="panel-title-row">
            <h2>{t('Return')}</h2>
            <Badge status={o.return.status} />
          </div>
          <p><strong>{t('Reason')}:</strong> {o.return.reason}</p>
          {o.return.note && (
            <p className="muted-small"><strong>{t('Note')}:</strong> {o.return.note}</p>
          )}
        </section>
      )}

      {/* Order Timeline Activity */}
      {o.events && o.events.length > 0 && (
        <section className="panel">
          <h2>{t('Order activity')}</h2>
          <ol className="order-timeline">
            {o.events.map((event, idx) => (
              <li key={idx} className="timeline-item">
                <div className="timeline-icon">
                  <Clock size={16} />
                </div>
                <div className="timeline-content">
                  <span className="timeline-action">{t(event.action)}</span>
                  {event.details?.note && (
                    <span className="timeline-note muted-small"> — {event.details.note}</span>
                  )}
                </div>
                <time className="timeline-time muted-small">{formatDate(event.created_at, language)}</time>
              </li>
            ))}
          </ol>
        </section>
      )}

      {verifyingItem && (
        <BarcodeScannerModal
          isOpen={Boolean(verifyingItem)}
          onClose={() => setVerifyingItem(null)}
          mode="verify"
          orderId={orderId}
          item={verifyingItem}
          onVerified={async () => {
            await loadOrder();
          }}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
