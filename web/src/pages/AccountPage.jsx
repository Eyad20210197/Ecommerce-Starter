import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useModal } from '../context/ModalContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { User, MapPin, Key, Plus, Trash2, Edit3, Package } from 'lucide-react';

export function AccountPage({ onNavigate }) {
  const { t } = useStore();
  const { user, loading: authLoading, updateProfile, changePassword } = useAuth();
  const { openModal, closeModal } = useModal();
  const { notice } = useToast();

  const [addresses, setAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  // Profile Form state
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Redirect to login if user is not authenticated after session loads
  useEffect(() => {
    if (!authLoading && !user) {
      onNavigate('/login');
    }
  }, [authLoading, user, onNavigate]);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfilePhone(user.phone || '');
      loadAddresses();
    }
  }, [user]);

  const loadAddresses = async () => {
    try {
      setLoadingAddresses(true);
      const res = await api('/auth/addresses');
      setAddresses(res.addresses || []);
    } catch {
      setAddresses([]);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      await updateProfile({ name: profileName.trim(), phone: profilePhone.trim() });
      notice(t('Saved.'));
    } catch (err) {
      notice(err.message, true);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      setSavingPassword(true);
      await changePassword({ currentPassword, password: newPassword });
      setCurrentPassword('');
      setNewPassword('');
      notice(t('Saved.'));
    } catch (err) {
      notice(err.message, true);
    } finally {
      setSavingPassword(false);
    }
  };

  // Address Modal Dialog
  const handleOpenAddressModal = (addressToEdit = null) => {
    const isEdit = Boolean(addressToEdit);
    const initialLabel = addressToEdit?.label || '';
    const rawData = addressToEdit?.data;
    const parsedData = rawData ? (typeof rawData === 'string' ? (() => { try { return JSON.parse(rawData); } catch { return {}; } })() : rawData) : null;
    const initialData = {
      name: parsedData?.name || user?.name || '',
      phone: parsedData?.phone || user?.phone || '',
      line1: parsedData?.line1 || '',
      line2: parsedData?.line2 || '',
      city: parsedData?.city || '',
      region: parsedData?.region || '',
      postalCode: parsedData?.postalCode || '',
      country: parsedData?.country || 'US'
    };

    openModal(
      isEdit ? 'Edit' : 'Add address',
      ({ close }) => {
        const [label, setLabel] = useState(initialLabel);
        const [formData, setFormData] = useState(initialData);
        const [submitting, setSubmitting] = useState(false);
        const [error, setError] = useState('');

        const handleSubmit = async (e) => {
          e.preventDefault();
          try {
            setSubmitting(true);
            setError('');
            if (isEdit) {
              await api(`/auth/addresses/${addressToEdit.id}`, {
                method: 'PATCH',
                body: { label: label.trim(), data: formData }
              });
            } else {
              await api('/auth/addresses', {
                method: 'POST',
                body: { label: label.trim(), data: formData }
              });
            }
            await loadAddresses();
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

            <div className="form-group">
              <label className="field-label">{t('Address label')}</label>
              <input 
                type="text" 
                required 
                maxLength={40}
                value={label} 
                onChange={e => setLabel(e.target.value)} 
                placeholder="e.g. Home, Office"
                className="input-field" 
              />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="field-label">{t('Full name')}</label>
                <input 
                  type="text" 
                  required 
                  maxLength={100}
                  value={formData.name} 
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="input-field" 
                />
              </div>

              <div className="form-group">
                <label className="field-label">{t('Phone')}</label>
                <input 
                  type="tel" 
                  required 
                  maxLength={30}
                  value={formData.phone} 
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                  className="input-field" 
                />
              </div>

              <div className="form-group span-2">
                <label className="field-label">{t('Address line 1')}</label>
                <input 
                  type="text" 
                  required 
                  maxLength={160}
                  value={formData.line1} 
                  onChange={e => setFormData(p => ({ ...p, line1: e.target.value }))}
                  className="input-field" 
                />
              </div>

              <div className="form-group span-2">
                <label className="field-label">{t('Address line 2')}</label>
                <input 
                  type="text" 
                  maxLength={160}
                  value={formData.line2} 
                  onChange={e => setFormData(p => ({ ...p, line2: e.target.value }))}
                  className="input-field" 
                />
              </div>

              <div className="form-group">
                <label className="field-label">{t('City')}</label>
                <input 
                  type="text" 
                  required 
                  maxLength={80}
                  value={formData.city} 
                  onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
                  className="input-field" 
                />
              </div>

              <div className="form-group">
                <label className="field-label">{t('State / region')}</label>
                <input 
                  type="text" 
                  maxLength={80}
                  value={formData.region} 
                  onChange={e => setFormData(p => ({ ...p, region: e.target.value }))}
                  className="input-field" 
                />
              </div>

              <div className="form-group">
                <label className="field-label">{t('Postal code')}</label>
                <input 
                  type="text" 
                  maxLength={20}
                  value={formData.postalCode} 
                  onChange={e => setFormData(p => ({ ...p, postalCode: e.target.value }))}
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
                  value={formData.country} 
                  onChange={e => setFormData(p => ({ ...p, country: e.target.value.toUpperCase() }))}
                  className="input-field uppercase-input" 
                />
              </div>
            </div>

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

  const handleDeleteAddress = (id) => {
    openModal(
      'Delete',
      ({ close }) => (
        <div className="stack">
          <p>{t('Are you sure you want to delete this saved address?')}</p>
          <div className="modal-actions">
            <button 
              className="btn btn-danger"
              onClick={async () => {
                try {
                  await api(`/auth/addresses/${id}`, { method: 'DELETE' });
                  await loadAddresses();
                  notice(t('Saved.'));
                  close();
                } catch (err) {
                  notice(err.message, true);
                }
              }}
            >
              {t('Delete')}
            </button>
            <button className="btn btn-secondary" onClick={close}>
              {t('Cancel')}
            </button>
          </div>
        </div>
      )
    );
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

  return (
    <div className="container-page medium">
      <div className="page-top">
        <h1>{t('Account')}</h1>
        <button 
          className="btn btn-secondary"
          onClick={() => onNavigate('/orders')}
        >
          <Package size={16} />
          <span>{t('Order history')}</span>
        </button>
      </div>

      <div className="account-sections">
        {/* Profile Details */}
        <section className="panel account-panel">
          <div className="panel-header-row">
            <h2>{t('Profile')}</h2>
            <span className="muted-small">{user.email}</span>
          </div>

          <form onSubmit={handleSaveProfile} className="stack">
            <div className="form-grid">
              <div className="form-group">
                <label className="field-label">{t('Full name')}</label>
                <input 
                  type="text" 
                  required 
                  maxLength={100}
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="form-group">
                <label className="field-label">{t('Phone')}</label>
                <input 
                  type="tel" 
                  maxLength={30}
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={savingProfile}
            >
              {savingProfile ? t('Loading…') : t('Save changes')}
            </button>
          </form>
        </section>

        {/* Saved Addresses Book */}
        <section className="panel account-panel">
          <div className="panel-header-row">
            <h2>{t('Saved addresses')}</h2>
            <button 
              className="btn btn-secondary btn-small"
              onClick={() => handleOpenAddressModal()}
            >
              <Plus size={14} />
              <span>{t('Add address')}</span>
            </button>
          </div>

          {loadingAddresses ? (
            <p className="muted-small">{t('Loading…')}</p>
          ) : addresses.length > 0 ? (
            <div className="address-card-list">
              {addresses.map(a => {
                const raw = a.data;
                const d = raw ? (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw) : {};
                return (
                  <div key={a.id} className="address-card">
                    <div className="address-card-info">
                      <strong>{a.label}</strong>
                      <p className="muted-small">
                        {d.name || ''} {d.phone ? `· ${d.phone}` : ''}<br />
                        {d.line1 || ''} {d.line2 ? `(${d.line2})` : ''}<br />
                        {[d.city, d.region, d.postalCode, d.country].filter(Boolean).join(', ')}
                      </p>
                    </div>

                    <div className="address-card-actions">
                      <button 
                        type="button"
                        className="btn-icon" 
                        onClick={() => handleOpenAddressModal(a)} 
                        title={t('Edit')}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        type="button"
                        className="btn-icon btn-icon-danger" 
                        onClick={() => handleDeleteAddress(a.id)} 
                        title={t('Delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted-small">{t('Nothing to show yet.')}</p>
          )}
        </section>

        {/* Change Password */}
        <section className="panel account-panel">
          <h2>{t('Change password')}</h2>
          <form onSubmit={handleChangePassword} className="stack">
            <div className="form-group">
              <label className="field-label">{t('Current password')}</label>
              <input 
                type="password" 
                required 
                autoComplete="current-password"
                maxLength={128}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="form-group">
              <label className="field-label">{t('New password')}</label>
              <input 
                type="password" 
                required 
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field"
              />
              <span className="field-hint">{t('At least 12 characters')}</span>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={savingPassword}
            >
              {savingPassword ? t('Loading…') : t('Change password')}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
