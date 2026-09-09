import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { storeConfig, themePresets } from '../config/store.config.js';
import { api } from '../lib/api.js';
import { t, getDirection } from '../lib/i18n.js';
import { formatMoney } from '../lib/formatters.js';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [backendConfig, setBackendConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const initialLang = localStorage.getItem('language') || storeConfig.i18n.defaultLanguage;
  const [language, setLanguageState] = useState(initialLang);

  const initialCurrency = localStorage.getItem('currency') || storeConfig.i18n.defaultCurrency;
  const [currency, setCurrencyState] = useState(initialCurrency);

  const initialPreset = localStorage.getItem('theme_preset') || storeConfig.activePreset || 'modern_emerald';
  const [activePreset, setActivePresetState] = useState(initialPreset);

  const stockListeners = useRef(new Map());

  const applyThemeTokens = useCallback((presetName) => {
    const root = document.documentElement;
    const preset = themePresets[presetName] || themePresets.modern_emerald;
    const theme = {
      ...preset,
      primary: storeConfig.theme.primary || preset.primary,
      primaryHover: storeConfig.theme.primaryHover || preset.primaryHover
    };
    root.style.setProperty('--brand', theme.primary);
    root.style.setProperty('--brand-hover', theme.primaryHover);
    root.style.setProperty('--ink', theme.ink);
    root.style.setProperty('--muted', theme.muted);
    root.style.setProperty('--line', theme.border);
    root.style.setProperty('--surface', theme.surface);
    root.style.setProperty('--surface-card', theme.surfaceCard);
    root.style.setProperty('--danger', theme.danger);
    root.style.setProperty('--danger-surface', theme.dangerSurface);
    root.style.setProperty('--success', theme.success);
    root.style.setProperty('--success-surface', theme.successSurface);
    root.style.setProperty('--warning', theme.warning);
    root.style.setProperty('--warning-surface', theme.warningSurface);
    root.style.setProperty('--radius', theme.radius);
    root.style.setProperty('--font-family', theme.fontFamily);
  }, []);

  // Apply theme tokens whenever activePreset changes
  useEffect(() => {
    applyThemeTokens(activePreset);
  }, [activePreset, applyThemeTokens]);

  const setThemePreset = useCallback((presetName) => {
    if (themePresets[presetName]) {
      setActivePresetState(presetName);
      localStorage.setItem('theme_preset', presetName);
    }
  }, []);

  // Sync language with HTML dir and lang
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = getDirection(language);
    localStorage.setItem('language', language);
  }, [language]);

  const setLanguage = useCallback((newLang) => {
    setLanguageState(newLang);
  }, []);

  const setCurrency = useCallback((newCurr) => {
    setCurrencyState(newCurr);
    localStorage.setItem('currency', newCurr);
  }, []);

  // Fetch backend store configuration
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const conf = await api('/config');
      setBackendConfig(conf);
      if (conf.currency && !localStorage.getItem('currency')) {
        setCurrencyState(conf.currency);
      }
    } catch (err) {
      console.warn('Backend store config offline, using local store configuration', err);
      // Fallback gracefully so the storefront is always fully accessible and interactive
      setBackendConfig({
        name: storeConfig.brand.name,
        email: storeConfig.brand.supportEmail,
        currency: storeConfig.i18n.defaultCurrency || 'USD',
        language: storeConfig.i18n.defaultLanguage || 'en',
        currencies: storeConfig.i18n.defaultRates,
        languages: ['en', 'ar'],
        shippingFeeMinor: 0,
        taxBps: 0,
        paymentMethods: ['cod']
      });
    } finally {
      setLoading(false);
    }
  }, [storeConfig]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Live Inventory SSE updates
  useEffect(() => {
    if (!storeConfig.features.liveInventoryUpdates) return;
    let stream;
    try {
      stream = new EventSource('/api/v1/events');
      stream.addEventListener('inventory', (event) => {
        try {
          const { id } = JSON.parse(event.data);
          const callbacks = stockListeners.current.get(id);
          if (callbacks) {
            callbacks.forEach(cb => cb(id));
          }
        } catch {
          // Ignore malformed event
        }
      });
    } catch {
      // EventSource failed or unavailable
    }

    return () => {
      stream?.close();
    };
  }, [storeConfig.features.liveInventoryUpdates]);

  const subscribeStock = useCallback((productId, callback) => {
    if (!stockListeners.current.has(productId)) {
      stockListeners.current.set(productId, new Set());
    }
    stockListeners.current.get(productId).add(callback);

    return () => {
      const callbacks = stockListeners.current.get(productId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) stockListeners.current.delete(productId);
      }
    };
  }, []);

  const formatPrice = useCallback((amount, convert = false) => {
    const baseCurr = backendConfig?.currency || storeConfig.i18n.defaultCurrency;
    const rates = (backendConfig?.currencies && Object.keys(backendConfig.currencies).length > 1)
      ? backendConfig.currencies
      : { ...storeConfig.i18n.defaultRates, [baseCurr]: 1 };
    return formatMoney(amount, currency, rates, baseCurr, language, convert);
  }, [backendConfig, currency, language, storeConfig]);

  const value = {
    storeConfig,
    backendConfig,
    loading,
    error,
    retryConfig: loadConfig,
    language,
    setLanguage,
    currency,
    setCurrency,
    formatPrice,
    subscribeStock,
    themePresets,
    activePreset,
    setThemePreset,
    t: (key) => t(key, language)
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
}
