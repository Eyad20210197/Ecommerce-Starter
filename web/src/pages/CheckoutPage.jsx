import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { productName } from '../lib/formatters.js';
import { EmptyState } from '../components/common/EmptyState.jsx';
import { CheckCircle, ShieldCheck, ArrowRight } from 'lucide-react';

export function CheckoutPage({ onNavigate }) {
  const { storeConfig, backendConfig, currency, formatPrice, language, t } = useStore();
  const { user } = useAuth();
  const { items, summary, refreshCart, hasUnavailableItems } = useCart();
  const { notice } = useToast();

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Form states
  const [contact, setContact] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || ''
  });

  const [address, setAddress] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    recipientName: '',
    recipientPhone: '',
    line1: '',
    line2: '',
    city: '',
    region: '',
    postalCode: '',
    country: 'US'
  });

  const [saveAddress, setSaveAddress] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [notes, setNotes] = useState('');

  // Load saved addresses and synchronize user profile details
  useEffect(() => {
    if (user) {
      setContact(prev => ({
        name: prev.name || user.name || '',
        email: prev.email || user.email || '',
        phone: prev.phone || user.phone || ''
      }));
      setAddress(prev => ({
        ...prev,
        name: prev.name || user.name || '',
        phone: prev.phone || user.phone || ''
      }));

      api('/auth/addresses')
        .then(res => {
          const list = res.addresses || [];
          setSavedAddresses(list);
          // If profile phone was empty, check if first saved address has phone
          if (!user.phone && list.length > 0) {
            const firstData = list[0]?.data;
            const parsed = firstData ? (typeof firstData === 'string' ? (() => { try { return JSON.parse(firstData); } catch { return null; } })() : firstData) : null;
            if (parsed?.phone) {
              setContact(prev => ({ ...prev, phone: prev.phone || parsed.phone }));
              setAddress(prev => ({ ...prev, phone: prev.phone || parsed.phone }));
            }
          }
        })
        .catch(() => setSavedAddresses([]));
    }
  }, [user]);

  const handleSavedAddressChange = (addressId) => {
    setSelectedAddressId(addressId);
    if (!addressId) return;

    const saved = savedAddresses.find(a => a.id === addressId);
    if (saved) {
      const raw = saved.data;
      const d = raw ? (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw) : {};

      const addrPhone = d.phone || user?.phone || contact.phone || '';
      const addrName = d.name || user?.name || contact.name || '';

      setAddress(prev => ({
        ...prev,
        name: addrName,
        phone: addrPhone,
        recipientName: d.name || '',
        recipientPhone: d.phone || '',
        line1: d.line1 || '',
        line2: d.line2 || '',
        city: d.city || '',
        region: d.region || '',
        postalCode: d.postalCode || '',
        country: d.country || 'US'
      }));

      // Automatically fill contact phone if currently empty
      if (addrPhone) {
        setContact(prev => ({
          ...prev,
          phone: prev.phone || addrPhone
        }));
      }
      if (addrName) {
        setContact(prev => ({
          ...prev,
          name: prev.name || addrName
        }));
      }

      // Clear any existing address field errors
      setFieldErrors(prev => ({
        ...prev,
        line1: null,
        city: null,
        country: null,
        recipientName: null,
        recipientPhone: null
      }));
    }
  };

  const validateForm = () => {
    const errs = {};
    const contactName = contact.name.trim();
    const contactEmail = contact.email.trim();
    const contactPhone = contact.phone.trim();
    const line1 = address.line1.trim();
    const city = address.city.trim();
    const country = address.country.trim().toUpperCase();
    const recipientName = (address.recipientName || address.name || contactName).trim();
    const recipientPhone = (address.recipientPhone || address.phone || contactPhone).trim();

    if (!contactName || contactName.length < 2) {
      errs.name = t('Please enter your full name (at least 2 characters).');
    }
    if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      errs.email = t('Please enter a valid email address.');
    }
    if (!contactPhone || contactPhone.length < 6) {
      errs.phone = t('Please enter a valid phone number (at least 6 digits).');
    }
    if (!line1 || line1.length < 3) {
      errs.line1 = t('Address line 1 must be at least 3 characters.');
    }
    if (!city || city.length < 2) {
      errs.city = t('City must be at least 2 characters.');
    }
    if (!country || !/^[A-Z]{2}$/.test(country)) {
      errs.country = t('Please enter a valid 2-letter country code (e.g. US, EG).');
    }
    if (address.recipientName && recipientName.length < 2) {
      errs.recipientName = t('Recipient name must be at least 2 characters.');
    }
    if (address.recipientPhone && recipientPhone.length < 6) {
      errs.recipientPhone = t('Recipient phone must be at least 6 digits.');
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!items.length || hasUnavailableItems) {
      setFormError(t('Please review your cart before checking out.'));
      return;
    }

    if (!validateForm()) {
      setFormError(t('Please check the highlighted fields below.'));
      return;
    }

    try {
      setSubmitting(true);

      const recipientName = (address.recipientName || address.name || contact.name).trim();
      const recipientPhone = (address.recipientPhone || address.phone || contact.phone).trim();

      const orderBody = {
        contact: {
          name: contact.name.trim(),
          email: contact.email.trim().toLowerCase(),
          phone: contact.phone.trim()
        },
        address: {
          name: recipientName,
          phone: recipientPhone,
          line1: address.line1.trim(),
          line2: (address.line2 || '').trim(),
          city: address.city.trim(),
          region: (address.region || '').trim(),
          postalCode: (address.postalCode || '').trim(),
          country: address.country.trim().toUpperCase()
        },
        currency,
        payment_method: paymentMethod,
        notes: notes.trim(),
        items: items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity
        }))
      };

      // Generate Idempotency Key via SHA-256 fingerprinting
      const hashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(orderBody)));
      const fingerprint = Array.from(new Uint8Array(hashBytes), b => b.toString(16).padStart(2, '0')).join('');

      let attempt = JSON.parse(sessionStorage.getItem('checkout-attempt') || 'null');
      if (!attempt || attempt.fingerprint !== fingerprint) {
        attempt = { key: crypto.randomUUID(), fingerprint };
        sessionStorage.setItem('checkout-attempt', JSON.stringify(attempt));
      }

      const result = await api('/orders', {
        method: 'POST',
        body: orderBody,
        headers: { 'Idempotency-Key': attempt.key }
      });

      // Save guest token in sessionStorage for capability access if guest checkout
      if (result.guestToken) {
        sessionStorage.setItem(`order:${result.id}`, result.guestToken);
      }
      sessionStorage.removeItem('checkout-attempt');

      // Optionally save address for logged-in user
      if (saveAddress && user) {
        try {
          await api('/auth/addresses', {
            method: 'POST',
            body: { label: orderBody.address.city || 'Home', data: orderBody.address }
          });
        } catch {
          // Address save is non-blocking
        }
      }

      await refreshCart();
      notice(t('Your order is placed.'));
      onNavigate(`/orders/${result.id}`);
    } catch (err) {
      const msg = err.message || '';
      const mapped = {};
      if (msg.includes('contact.name') || msg.includes('address.name')) {
        mapped.name = t('Full name must be at least 2 characters.');
      }
      if (msg.includes('contact.email')) {
        mapped.email = t('Please enter a valid email address.');
      }
      if (msg.includes('contact.phone') || msg.includes('address.phone')) {
        mapped.phone = t('Please enter a valid phone number (at least 6 digits).');
      }
      if (msg.includes('line1')) {
        mapped.line1 = t('Address line 1 must be at least 3 characters.');
      }
      if (msg.includes('city')) {
        mapped.city = t('City must be at least 2 characters.');
      }
      if (msg.includes('country')) {
        mapped.country = t('Please enter a valid 2-letter country code.');
      }

      if (Object.keys(mapped).length > 0) {
        setFieldErrors(prev => ({ ...prev, ...mapped }));
        setFormError(t('Please check the highlighted fields below.'));
      } else {
        setFormError(msg || t('Failed to place order.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!items.length) {
    return (
      <div className="container-page">
        <h1>{t('Checkout')}</h1>
        <EmptyState 
          title="Your cart is empty"
          subtitle="Add items to your cart before proceeding to checkout."
          actionLabel="Continue shopping"
          onAction={() => onNavigate('/')}
        />
      </div>
    );
  }

  const paymentMethods = backendConfig?.paymentMethods || ['cod'];

  return (
    <div className="container-page">
      <h1>{t('Checkout')}</h1>

      <div className="checkout-layout">
        <form onSubmit={handlePlaceOrder} noValidate className="checkout-form">
          {formError && (
            <div className="alert-box alert-error" role="alert">
              {formError}
            </div>
          )}

          {/* Contact Details */}
          <section className="panel checkout-panel">
            <h2>{t('Contact details')}</h2>
            <div className="form-grid">
              <div className="form-group">
                <label className="field-label">{t('Full name')}</label>
                <input 
                  type="text" 
                  required 
                  autoComplete="name"
                  maxLength={100}
                  value={contact.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setContact(prev => ({ ...prev, name: val }));
                    if (!address.recipientName) setAddress(prev => ({ ...prev, name: val }));
                    if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: null }));
                  }}
                  className={`input-field ${fieldErrors.name ? 'input-error' : ''}`}
                  aria-invalid={Boolean(fieldErrors.name)}
                />
                {fieldErrors.name && <p className="field-error-msg">{fieldErrors.name}</p>}
              </div>

              <div className="form-group">
                <label className="field-label">{t('Email')}</label>
                <input 
                  type="email" 
                  required 
                  autoComplete="email"
                  maxLength={254}
                  value={contact.email}
                  onChange={(e) => {
                    setContact(prev => ({ ...prev, email: e.target.value }));
                    if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: null }));
                  }}
                  className={`input-field ${fieldErrors.email ? 'input-error' : ''}`}
                  aria-invalid={Boolean(fieldErrors.email)}
                />
                {fieldErrors.email && <p className="field-error-msg">{fieldErrors.email}</p>}
              </div>

              <div className="form-group span-2">
                <label className="field-label">{t('Phone')}</label>
                <input 
                  type="tel" 
                  required 
                  autoComplete="tel"
                  maxLength={30}
                  value={contact.phone}
                  onChange={(e) => {
                    const val = e.target.value;
                    setContact(prev => ({ ...prev, phone: val }));
                    if (!address.recipientPhone) setAddress(prev => ({ ...prev, phone: val }));
                    if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: null }));
                  }}
                  className={`input-field ${fieldErrors.phone ? 'input-error' : ''}`}
                  aria-invalid={Boolean(fieldErrors.phone)}
                />
                {fieldErrors.phone && <p className="field-error-msg">{fieldErrors.phone}</p>}
              </div>
            </div>
          </section>

          {/* Delivery Address */}
          <section className="panel checkout-panel">
            <div className="panel-title-row">
              <h2>{t('Delivery address')}</h2>
              {savedAddresses.length > 0 && (
                <div className="saved-addr-select">
                  <select 
                    value={selectedAddressId} 
                    onChange={(e) => handleSavedAddressChange(e.target.value)}
                    className="input-field select-small"
                  >
                    <option value="">{t('Use a new address')}</option>
                    {savedAddresses.map(a => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="field-label">{t('Address line 1')}</label>
                <input 
                  type="text" 
                  required 
                  autoComplete="address-line1"
                  maxLength={160}
                  value={address.line1}
                  onChange={(e) => {
                    setAddress(prev => ({ ...prev, line1: e.target.value }));
                    if (fieldErrors.line1) setFieldErrors(prev => ({ ...prev, line1: null }));
                  }}
                  className={`input-field ${fieldErrors.line1 ? 'input-error' : ''}`}
                  aria-invalid={Boolean(fieldErrors.line1)}
                />
                {fieldErrors.line1 && <p className="field-error-msg">{fieldErrors.line1}</p>}
              </div>

              <div className="form-group">
                <label className="field-label">{t('Address line 2')}</label>
                <input 
                  type="text" 
                  autoComplete="address-line2"
                  maxLength={160}
                  value={address.line2}
                  onChange={(e) => setAddress(prev => ({ ...prev, line2: e.target.value }))}
                  className="input-field"
                />
              </div>

              <div className="form-group">
                <label className="field-label">{t('City')}</label>
                <input 
                  type="text" 
                  required 
                  autoComplete="address-level2"
                  maxLength={80}
                  value={address.city}
                  onChange={(e) => {
                    setAddress(prev => ({ ...prev, city: e.target.value }));
                    if (fieldErrors.city) setFieldErrors(prev => ({ ...prev, city: null }));
                  }}
                  className={`input-field ${fieldErrors.city ? 'input-error' : ''}`}
                  aria-invalid={Boolean(fieldErrors.city)}
                />
                {fieldErrors.city && <p className="field-error-msg">{fieldErrors.city}</p>}
              </div>

              <div className="form-group">
                <label className="field-label">{t('State / region')}</label>
                <input 
                  type="text" 
                  autoComplete="address-level1"
                  maxLength={80}
                  value={address.region}
                  onChange={(e) => setAddress(prev => ({ ...prev, region: e.target.value }))}
                  className="input-field"
                />
              </div>

              <div className="form-group">
                <label className="field-label">{t('Postal code')}</label>
                <input 
                  type="text" 
                  autoComplete="postal-code"
                  maxLength={20}
                  value={address.postalCode}
                  onChange={(e) => setAddress(prev => ({ ...prev, postalCode: e.target.value }))}
                  className="input-field"
                />
              </div>

              <div className="form-group">
                <label className="field-label">{t('Country code')}</label>
                <input 
                  type="text" 
                  required 
                  pattern="[A-Z]{2}"
                  maxLength={2}
                  autoComplete="country"
                  value={address.country}
                  onChange={(e) => {
                    setAddress(prev => ({ ...prev, country: e.target.value.toUpperCase() }));
                    if (fieldErrors.country) setFieldErrors(prev => ({ ...prev, country: null }));
                  }}
                  placeholder="US"
                  className={`input-field uppercase-input ${fieldErrors.country ? 'input-error' : ''}`}
                  aria-invalid={Boolean(fieldErrors.country)}
                />
                {fieldErrors.country && <p className="field-error-msg">{fieldErrors.country}</p>}
              </div>

              {/* Optional Recipient Information */}
              <div className="form-group">
                <label className="field-label">{t('Recipient name (optional)')}</label>
                <input 
                  type="text" 
                  maxLength={100}
                  value={address.recipientName}
                  onChange={(e) => {
                    setAddress(prev => ({ ...prev, recipientName: e.target.value }));
                    if (fieldErrors.recipientName) setFieldErrors(prev => ({ ...prev, recipientName: null }));
                  }}
                  placeholder={contact.name || t('Same as contact name')}
                  className={`input-field ${fieldErrors.recipientName ? 'input-error' : ''}`}
                />
                {fieldErrors.recipientName && <p className="field-error-msg">{fieldErrors.recipientName}</p>}
              </div>

              <div className="form-group">
                <label className="field-label">{t('Recipient phone (optional)')}</label>
                <input 
                  type="tel" 
                  maxLength={30}
                  value={address.recipientPhone}
                  onChange={(e) => {
                    setAddress(prev => ({ ...prev, recipientPhone: e.target.value }));
                    if (fieldErrors.recipientPhone) setFieldErrors(prev => ({ ...prev, recipientPhone: null }));
                  }}
                  placeholder={contact.phone || t('Same as contact phone')}
                  className={`input-field ${fieldErrors.recipientPhone ? 'input-error' : ''}`}
                />
                {fieldErrors.recipientPhone && <p className="field-error-msg">{fieldErrors.recipientPhone}</p>}
              </div>

              {user && (
                <div className="form-group span-2">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={saveAddress}
                      onChange={(e) => setSaveAddress(e.target.checked)}
                    />
                    <span>{t('Save this address')}</span>
                  </label>
                </div>
              )}
            </div>
          </section>

          {/* Payment Method & Notes */}
          <section className="panel checkout-panel">
            <h2>{t('Payment method')}</h2>
            <div className="payment-options">
              {paymentMethods.includes('cod') && (
                <label className={`payment-radio ${paymentMethod === 'cod' ? 'selected' : ''}`}>
                  <input 
                    type="radio" 
                    name="payment_method" 
                    value="cod" 
                    checked={paymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                  />
                  <div className="payment-radio-content">
                    <ShieldCheck size={20} />
                    <div>
                      <strong>{t('Cash on delivery')}</strong>
                      <p className="muted-small">{t('Pay in cash upon delivery to your doorstep.')}</p>
                    </div>
                  </div>
                </label>
              )}

              {paymentMethods.includes('stripe') && (
                <label className={`payment-radio ${paymentMethod === 'stripe' ? 'selected' : ''}`}>
                  <input 
                    type="radio" 
                    name="payment_method" 
                    value="stripe" 
                    checked={paymentMethod === 'stripe'}
                    onChange={() => setPaymentMethod('stripe')}
                  />
                  <div className="payment-radio-content">
                    <div>
                      <strong>{t('Online payment')}</strong>
                      <p className="muted-small">{t('Pay securely with credit or debit card.')}</p>
                    </div>
                  </div>
                </label>
              )}
            </div>

            <div className="form-group mt-4">
              <label className="field-label">{t('Order notes')}</label>
              <textarea 
                maxLength={500}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('Delivery instructions, apartment number, etc.')}
                className="input-field input-textarea"
              />
            </div>
          </section>

          <button 
            type="submit" 
            className="btn btn-primary btn-block btn-place-order"
            disabled={submitting || hasUnavailableItems}
          >
            <span>{submitting ? t('Loading…') : t('Place order')}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Order Summary Column */}
        <aside className="checkout-summary-aside">
          <div className="panel summary-panel">
            <h2>{t('Order summary')}</h2>

            <div className="checkout-items-list">
              {items.map(item => (
                <div key={item.product_id} className="checkout-item-line">
                  <span className="item-name-qty">
                    {productName(item, language)} × {item.quantity}
                  </span>
                  <span className="item-price">
                    {formatPrice(item.price_minor * item.quantity, true)}
                  </span>
                </div>
              ))}
            </div>

            <hr className="divider" />

            <div className="summary-rows">
              <div className="summary-row">
                <span>{t('Subtotal')}</span>
                <span>{formatPrice(summary.subtotalMinor, false)}</span>
              </div>
              <div className="summary-row">
                <span>{t('Shipping')}</span>
                <span>{formatPrice(summary.shippingMinor, false)}</span>
              </div>
              <div className="summary-row">
                <span>{t('Tax')}</span>
                <span>{formatPrice(summary.taxMinor, false)}</span>
              </div>
              <div className="summary-row total-row">
                <span>{t('Total')}</span>
                <strong>{formatPrice(summary.totalMinor, false)}</strong>
              </div>
            </div>

            <div className="summary-footer-note">
              <p>{t('Full-order returns only.')} {backendConfig?.returnWindowDays || 14} {language === 'ar' ? 'يوماً من التوصيل.' : 'days from delivery.'}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
