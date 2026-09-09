import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext.jsx';
import { api } from '../../lib/api.js';
import { 
  ScanBarcode, 
  CheckCircle2, 
  XCircle, 
  X, 
  ArrowRight,
  RotateCcw
} from 'lucide-react';

/**
 * High-fidelity audio synthesizer using Web Audio API for warehouse feedback.
 */
export function playChime(type = 'success') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.28);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
      osc.frequency.setValueAtTime(146.83, ctx.currentTime + 0.12); // D3
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Audio context may be restricted before user interaction
  }
}

/**
 * BarcodeScannerModal
 * Dedicated Hardware Barcode Scanner & SKU Matching Dialog.
 * Works seamlessly with physical handheld USB / Bluetooth barcode guns and manual SKU entry.
 */
export function BarcodeScannerModal({
  isOpen,
  onClose,
  mode = 'verify', // 'verify' | 'lookup'
  orderId,
  item,
  onVerified,
  onNavigate
}) {
  const { t } = useStore();
  const [barcodeInput, setBarcodeInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const inputRef = useRef(null);

  // Auto-focus input and reset state on open
  useEffect(() => {
    if (isOpen) {
      setBarcodeInput('');
      setErrorMsg('');
      setSuccessMsg('');
      setLookupResult(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Hardware Scanner (Rapid keystrokes ending in Enter)
  useEffect(() => {
    if (!isOpen) return;
    let buffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
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
          handleScanCode(scanned);
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
  }, [isOpen, onClose]);

  // Unified barcode processing function
  const handleScanCode = async (rawCode) => {
    const code = String(rawCode || '').trim();
    if (!code || submitting) return;

    setBarcodeInput(code);
    setErrorMsg('');
    setSuccessMsg('');

    if (mode === 'verify') {
      // ORDER ITEM VERIFICATION MODE
      try {
        setSubmitting(true);
        const res = await api(`/orders/${orderId}/verify-item`, {
          method: 'POST',
          body: {
            item_id: item.id,
            itemId: item.id,
            barcode: code
          }
        });

        playChime('success');
        setSuccessMsg(`${t('SKU Matched!')} ${item.name}`);
        if (onVerified) {
          onVerified(res.item || res.order);
        }
        setTimeout(() => {
          onClose();
        }, 850);
      } catch (err) {
        playChime('error');
        setErrorMsg(err.message || `${t('Mismatched barcode')}: "${code}"`);
        setTimeout(() => inputRef.current?.select(), 100);
      } finally {
        setSubmitting(false);
      }
    } else {
      // STANDALONE INVENTORY LOOKUP MODE
      try {
        setSubmitting(true);
        const res = await api(`/inventory/lookup?code=${encodeURIComponent(code)}`);
        playChime('success');
        setLookupResult(res);
        setSuccessMsg(`${res.product.name} (${res.product.sku})`);
      } catch (err) {
        playChime('error');
        setLookupResult(null);
        setErrorMsg(err.message || `${t('No product found for')}: "${code}"`);
        setTimeout(() => inputRef.current?.select(), 100);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    handleScanCode(barcodeInput);
  };

  const handleResetLookup = () => {
    setLookupResult(null);
    setBarcodeInput('');
    setErrorMsg('');
    setSuccessMsg('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-window scanner-modal-window" role="dialog" aria-modal="true">
        {/* Modal Header */}
        <div className="modal-header">
          <div className="scanner-modal-title">
            <ScanBarcode size={22} className="text-primary" />
            <h2>
              {mode === 'verify' 
                ? t('Match & Verify Item SKU') 
                : t('Warehouse Barcode Scanner & Lookup')}
            </h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body stack">
          {/* Target Item Card (Verify Mode) */}
          {mode === 'verify' && item && (
            <div className="scanner-target-card">
              <div className="scanner-target-header">
                <span className="scanner-target-name">{item.name}</span>
                <span className="badge badge-neutral">{t('Qty')}: {item.quantity}</span>
              </div>
              <div className="scanner-target-sku-row">
                <span className="sku-label">{t('Required SKU')}:</span>
                <code className="scanner-sku-code">{item.sku}</code>
                {item.serials && item.serials.length > 0 && (
                  <span className="muted-small ml-2">
                    ({t('Serials')}: {item.serials.join(', ')})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Hardware Barcode Gun Ready Banner */}
          <div className="scanner-gun-prompt">
            <div className="scanner-gun-icon-box">
              <ScanBarcode size={24} className="text-primary" />
            </div>
            <div className="scanner-gun-text">
              <strong>{t('Hardware Barcode Scanner Ready')}</strong>
              <p className="muted-small">
                {t('Aim your handheld scanner gun and pull the trigger, or enter SKU below.')}
              </p>
            </div>
          </div>

          {/* Barcode Input Field + Match Button */}
          <form onSubmit={handleManualSubmit} className="scanner-input-group">
            <div className="input-with-icon">
              <ScanBarcode size={18} className="input-icon" />
              <input
                ref={inputRef}
                type="text"
                className="input-field scanner-text-input mono"
                placeholder={t('Scan barcode or enter SKU…')}
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                disabled={submitting}
                autoComplete="off"
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary btn-match-scanner"
              disabled={submitting || !barcodeInput.trim()}
            >
              {submitting ? t('Matching…') : t('Match')}
            </button>
          </form>

          {/* Error Banner */}
          {errorMsg && (
            <div className="alert-box alert-error scanner-alert-animate">
              <XCircle size={18} />
              <div className="alert-content">
                <strong>{t('Verification Mismatch')}</strong>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="alert-box alert-success scanner-alert-animate">
              <CheckCircle2 size={18} />
              <div className="alert-content">
                <strong>{t('Success!')}</strong>
                <p>{successMsg}</p>
              </div>
            </div>
          )}

          {/* Standalone Lookup Result Card */}
          {mode === 'lookup' && lookupResult && (
            <div className="scanner-lookup-result panel">
              <div className="lookup-result-header">
                <div>
                  <span className="eyebrow">{t('Product details')}</span>
                  <h3>{lookupResult.product.name}</h3>
                </div>
                <span className="badge badge-success">{lookupResult.product.active ? t('Active') : t('Inactive')}</span>
              </div>

              <div className="lookup-stats-grid">
                <div className="lookup-stat-card">
                  <span className="stat-label">{t('SKU')}</span>
                  <span className="stat-val mono">{lookupResult.product.sku}</span>
                </div>
                <div className="lookup-stat-card">
                  <span className="stat-label">{t('Available')}</span>
                  <span className="stat-val text-success">{lookupResult.product.available}</span>
                </div>
                <div className="lookup-stat-card">
                  <span className="stat-label">{t('On Hand')}</span>
                  <span className="stat-val">{lookupResult.product.on_hand}</span>
                </div>
                <div className="lookup-stat-card">
                  <span className="stat-label">{t('Reserved')}</span>
                  <span className="stat-val text-warning">{lookupResult.product.reserved}</span>
                </div>
              </div>

              {/* Serials list if serialized */}
              {lookupResult.product.serialized && (
                <div className="lookup-serials-section mt-3">
                  <h4>{t('Serial Numbers')} ({lookupResult.serials.length})</h4>
                  <div className="serials-chips-scroll">
                    {lookupResult.serials.length === 0 ? (
                      <p className="muted-small">{t('No active serial units.')}</p>
                    ) : (
                      lookupResult.serials.map(s => (
                        <div key={s.id} className="serial-chip">
                          <span className="mono">{s.serial}</span>
                          <span className={`badge badge-small badge-${s.status === 'available' ? 'success' : s.status === 'reserved' ? 'warning' : 'neutral'}`}>
                            {s.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Active Orders requiring this item */}
              <div className="lookup-orders-section mt-3">
                <h4>{t('Active Orders Awaiting This Product')} ({lookupResult.activeOrders.length})</h4>
                {lookupResult.activeOrders.length === 0 ? (
                  <p className="muted-small">{t('No pending placed/preparing orders for this product.')}</p>
                ) : (
                  <div className="table-responsive mt-1">
                    <table className="data-table small-table">
                      <thead>
                        <tr>
                          <th>{t('Order #')}</th>
                          <th>{t('Status')}</th>
                          <th>{t('Qty')}</th>
                          <th>{t('Verified')}</th>
                          <th>{t('Action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lookupResult.activeOrders.map(o => (
                          <tr key={o.id}>
                            <td><strong>#{o.number || o.id.slice(0, 8)}</strong></td>
                            <td><span className="badge badge-small badge-neutral">{o.status}</span></td>
                            <td>{o.quantity}</td>
                            <td>
                              {o.verified ? (
                                <span className="text-success small">✓ {t('Verified')}</span>
                              ) : (
                                <span className="text-warning small">○ {t('Pending')}</span>
                              )}
                            </td>
                            <td>
                              <button 
                                type="button" 
                                className="btn btn-secondary btn-small"
                                onClick={() => {
                                  onClose();
                                  if (onNavigate) onNavigate(`/orders/${o.id}`);
                                  else window.location.hash = `#/orders/${o.id}`;
                                }}
                              >
                                <span>{t('View order')}</span>
                                <ArrowRight size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="modal-actions mt-3">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={handleResetLookup}
                >
                  <ScanBarcode size={15} />
                  <span>{t('Scan another product')}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
