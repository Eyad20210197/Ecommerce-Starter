import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext.jsx';
import { api } from '../../lib/api.js';
import { Badge } from '../../components/common/Badge.jsx';
import { 
  Settings, 
  Sparkles, 
  Shield, 
  Cpu, 
  Headphones, 
  Truck, 
  Activity, 
  RefreshCw,
  Palette
} from 'lucide-react';

export function ManageSettings() {
  const { storeConfig, themePresets, activePreset, setThemePreset, t } = useStore();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // System Diagnostics
  const [healthStatus, setHealthStatus] = useState(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  const checkHealth = async () => {
    try {
      setCheckingHealth(true);
      const [hRes, rRes] = await Promise.allSettled([
        api('/health'),
        api('/ready')
      ]);

      setHealthStatus({
        api: hRes.status === 'fulfilled' && hRes.value?.status === 'ok' ? 'ok' : 'error',
        database: rRes.status === 'fulfilled' && rRes.value?.status === 'ready' ? 'ok' : 'unavailable',
        checkedAt: new Date().toLocaleTimeString()
      });
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const res = await api('/admin/settings');
        setSettings(res);
      } catch (err) {
        console.error('Failed to load settings', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
    checkHealth();
  }, []);

  if (loading && !settings) {
    return (
      <div className="workspace-subpage">
        <p className="loading-text">{t('Loading…')}</p>
      </div>
    );
  }

  const s = settings || {
    store: {},
    features: {
      payments: 'Cash on delivery',
      shipping: 'Manual',
      multiCurrency: false,
      multiLanguage: false
    }
  };

  return (
    <div className="workspace-subpage">
      <div className="page-top">
        <h1>{t('Settings')}</h1>
      </div>

      <div className="stack">
        {/* System Status Card */}
        <section className="panel">
          <div className="panel-title-row">
            <div className="flex-center gap-2">
              <Activity size={20} />
              <h2>{t('System status')}</h2>
            </div>
            <button 
              type="button" 
              className="btn btn-secondary btn-small"
              onClick={checkHealth}
              disabled={checkingHealth}
            >
              <RefreshCw size={14} className={checkingHealth ? 'spin' : ''} />
              <span>{checkingHealth ? t('Checking…') : t('Check status')}</span>
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('Service')}</th>
                  <th>{t('Status')}</th>
                  <th>{t('Connection')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>{t('Store server')}</strong></td>
                  <td>
                    <div className="health-status-row">
                      <span className={`health-dot ${healthStatus?.api === 'ok' ? 'ok' : 'error'}`} />
                      <span>{healthStatus?.api === 'ok' ? t('Working normally') : t('Offline')}</span>
                    </div>
                  </td>
                  <td className="muted-small">{healthStatus?.api === 'ok' ? t('Connected') : t('Checking…')}</td>
                </tr>
                <tr>
                  <td><strong>{t('Store database')}</strong></td>
                  <td>
                    <div className="health-status-row">
                      <span className={`health-dot ${healthStatus?.database === 'ok' ? 'ok' : 'error'}`} />
                      <span>{healthStatus?.database === 'ok' ? t('Connected & Ready') : t('Unavailable')}</span>
                    </div>
                  </td>
                  <td className="muted-small">{healthStatus?.database === 'ok' ? t('Ready') : t('Checking…')}</td>
                </tr>
                <tr>
                  <td><strong>{t('Live stock updates')}</strong></td>
                  <td>
                    <div className="health-status-row">
                      <span className="health-dot ok" />
                      <span>{storeConfig.features.liveInventoryUpdates ? t('Active') : t('Disabled')}</span>
                    </div>
                  </td>
                  <td className="muted-small">{t('Real-time')}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {healthStatus?.checkedAt && (
            <p className="muted-small mt-2">{t('Last checked')}: {healthStatus.checkedAt}</p>
          )}
        </section>

        {/* Theme Customizer & Presets */}
        <section className="panel">
          <div className="panel-title-row">
            <div className="flex-center gap-2">
              <Palette size={20} />
              <h2>{t('Store theme & style')}</h2>
            </div>
          </div>
          <p className="muted-small mb-3">
            {t('Choose a color style for your store.')}
          </p>

          <div className="preset-picker-grid">
            {Object.entries(themePresets || {}).map(([key, preset]) => (
              <div 
                key={key} 
                className={`preset-card ${activePreset === key ? 'active' : ''}`}
                onClick={() => setThemePreset(key)}
                style={{ cursor: 'pointer' }}
                aria-label={preset.name}
              >
                <strong>{preset.name}</strong>
                <div className="preset-colors-row">
                  <span className="preset-swatch" style={{ background: preset.primary }} title="Primary" />
                  <span className="preset-swatch" style={{ background: preset.primaryHover }} title="Hover" />
                  <span className="preset-swatch" style={{ background: preset.surface }} title="Surface" />
                  <span className="preset-swatch" style={{ background: preset.ink }} title="Ink" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 muted-small">
            <span>💡 {t('Click any color palette above to preview how your store looks.')}</span>
          </div>
        </section>

        {/* Core Store Configuration */}
        <section className="panel">
          <h2>{t('Store details')}</h2>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('Setting')}</th>
                  <th>{t('Value')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(s.store).map(([key, value]) => (
                  <tr key={key}>
                    <td><strong>{t(key)}</strong></td>
                    <td>{String(value || '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Feature Toggles Matrix */}
        <section className="panel">
          <h2>{t('Store features')}</h2>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('Feature')}</th>
                  <th>{t('Store Status')}</th>
                  <th>{t('Website Display')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t('Cash on delivery')}</td>
                  <td><Badge status="completed" label={t('Supported')} /></td>
                  <td><Badge status={storeConfig.features.cashOnDelivery ? 'completed' : 'cancelled'} label={t(storeConfig.features.cashOnDelivery ? 'Enabled' : 'Disabled')} /></td>
                </tr>
                <tr>
                  <td>{t('Online card payment')}</td>
                  <td><Badge status={s.features.payments === 'stripe' ? 'completed' : 'preparing'} label={s.features.payments === 'stripe' ? t('Supported') : t('Coming soon')} /></td>
                  <td><Badge status={storeConfig.features.onlinePayment ? 'completed' : 'cancelled'} label={t(storeConfig.features.onlinePayment ? 'Enabled' : 'Disabled')} /></td>
                </tr>
                <tr>
                  <td>{t('Product serial tracking')}</td>
                  <td><Badge status="completed" label={t('Active')} /></td>
                  <td><Badge status={storeConfig.features.serialNumberTracking ? 'completed' : 'cancelled'} label={t(storeConfig.features.serialNumberTracking ? 'Enabled' : 'Disabled')} /></td>
                </tr>
                <tr>
                  <td>{t('Customer order returns')}</td>
                  <td><Badge status="completed" label={t('Active')} /></td>
                  <td><Badge status={storeConfig.features.orderReturns ? 'completed' : 'cancelled'} label={t(storeConfig.features.orderReturns ? 'Enabled' : 'Disabled')} /></td>
                </tr>
                <tr>
                  <td>{t('Live stock updates')}</td>
                  <td><Badge status="completed" label={t('Active')} /></td>
                  <td><Badge status={storeConfig.features.liveInventoryUpdates ? 'completed' : 'cancelled'} label={t(storeConfig.features.liveInventoryUpdates ? 'Enabled' : 'Disabled')} /></td>
                </tr>
                <tr>
                  <td>{t('Saved customer addresses')}</td>
                  <td><Badge status="completed" label={t('Active')} /></td>
                  <td><Badge status={storeConfig.features.savedAddresses ? 'completed' : 'cancelled'} label={t(storeConfig.features.savedAddresses ? 'Enabled' : 'Disabled')} /></td>
                </tr>
                <tr>
                  <td>{t('Printable invoices')}</td>
                  <td><Badge status="completed" label={t('Active')} /></td>
                  <td><Badge status={storeConfig.features.invoices ? 'completed' : 'cancelled'} label={t(storeConfig.features.invoices ? 'Enabled' : 'Disabled')} /></td>
                </tr>
                <tr>
                  <td>{t('Guest checkout')}</td>
                  <td><Badge status="completed" label={t('Active')} /></td>
                  <td><Badge status={storeConfig.features.guestCheckout ? 'completed' : 'cancelled'} label={t(storeConfig.features.guestCheckout ? 'Enabled' : 'Disabled')} /></td>
                </tr>
                <tr>
                  <td>{t('Multiple currencies')}</td>
                  <td><Badge status={s.features.multiCurrency ? 'completed' : 'cancelled'} label={t(s.features.multiCurrency ? 'Enabled' : 'Disabled')} /></td>
                  <td><Badge status={storeConfig.features.multiCurrency ? 'completed' : 'cancelled'} label={t(storeConfig.features.multiCurrency ? 'Enabled' : 'Disabled')} /></td>
                </tr>
                <tr>
                  <td>{t('Multiple languages')}</td>
                  <td><Badge status={s.features.multiLanguage ? 'completed' : 'cancelled'} label={t(s.features.multiLanguage ? 'Enabled' : 'Disabled')} /></td>
                  <td><Badge status={storeConfig.features.multiLanguage ? 'completed' : 'cancelled'} label={t(storeConfig.features.multiLanguage ? 'Enabled' : 'Disabled')} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
