/**
 * Store Starter - Per-Project Configuration & Theming Engine
 * 
 * To brand and configure this application for a new client project:
 * 1. Adjust the `brand` properties below (or via environment variables).
 * 2. Customize the `theme` color palette and styling tokens.
 * 3. Toggle `features` on or off according to the client's needs.
 */

export const themePresets = {
  modern_emerald: {
    name: 'Modern Emerald',
    primary: '#17211e',
    primaryHover: '#273833',
    primaryLight: '#eef5f2',
    ink: '#1c1f1d',
    muted: '#636b64',
    border: '#dce0da',
    surface: '#f5f6f3',
    surfaceCard: '#ffffff',
    danger: '#b83232',
    dangerSurface: '#fdf2f2',
    success: '#2d6a4f',
    successSurface: '#edf7f1',
    warning: '#9c6b12',
    warningSurface: '#fef9ec',
    radius: '6px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  midnight_slate: {
    name: 'Midnight Slate',
    primary: '#0f172a',
    primaryHover: '#1e293b',
    primaryLight: '#f1f5f9',
    ink: '#0f172a',
    muted: '#64748b',
    border: '#cbd5e1',
    surface: '#f8fafc',
    surfaceCard: '#ffffff',
    danger: '#ef4444',
    dangerSurface: '#fef2f2',
    success: '#10b981',
    successSurface: '#ecfdf5',
    warning: '#f59e0b',
    warningSurface: '#fffbeb',
    radius: '8px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  warm_amber: {
    name: 'Warm Amber & Earth',
    primary: '#451a03',
    primaryHover: '#78350f',
    primaryLight: '#fef3c7',
    ink: '#292524',
    muted: '#78716c',
    border: '#e7e5e4',
    surface: '#fafaf9',
    surfaceCard: '#ffffff',
    danger: '#dc2626',
    dangerSurface: '#fef2f2',
    success: '#15803d',
    successSurface: '#f0fdf4',
    warning: '#b45309',
    warningSurface: '#fffbeb',
    radius: '4px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  pure_mono: {
    name: 'Pure Monochrome',
    primary: '#111827',
    primaryHover: '#374151',
    primaryLight: '#f3f4f6',
    ink: '#111827',
    muted: '#6b7280',
    border: '#e5e7eb',
    surface: '#f9fafb',
    surfaceCard: '#ffffff',
    danger: '#e11d48',
    dangerSurface: '#fff1f2',
    success: '#059669',
    successSurface: '#ecfdf5',
    warning: '#d97706',
    warningSurface: '#fffbeb',
    radius: '2px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif',
  },
  royal_indigo: {
    name: 'Royal Indigo',
    primary: '#312e81',
    primaryHover: '#4338ca',
    primaryLight: '#e0e7ff',
    ink: '#1e1b4b',
    muted: '#6b7280',
    border: '#c7d2fe',
    surface: '#f5f7ff',
    surfaceCard: '#ffffff',
    danger: '#e11d48',
    dangerSurface: '#fff1f2',
    success: '#16a34a',
    successSurface: '#f0fdf4',
    warning: '#ca8a04',
    warningSurface: '#fefce8',
    radius: '8px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  }
};

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});

const activePresetName = env.VITE_THEME_PRESET || 'modern_emerald';
const basePreset = themePresets[activePresetName] || themePresets.modern_emerald;

export const storeConfig = {
  // Brand Identity & Meta
  brand: {
    name: env.VITE_STORE_NAME || 'Aura Store',
    tagline: env.VITE_STORE_TAGLINE || 'Curated essentials for modern living',
    description: env.VITE_STORE_DESCRIPTION || 'Shop our collection of high quality everyday products.',
    logoUrl: env.VITE_STORE_LOGO_URL || '',
    supportEmail: env.VITE_STORE_EMAIL || 'support@example.com',
    copyright: `© ${new Date().getFullYear()} All rights reserved.`,
  },

  developer: {
    label: env.VITE_DEVELOPER_LABEL || 'Developed by The Software Guys',
    website: env.VITE_DEVELOPER_WEBSITE || 'https://thesoftwareguys.com',
  },

  // Active theme preset
  activePreset: activePresetName,

  // Visual Theme Tokens (merged from active preset and environment overrides)
  theme: {
    ...basePreset,
    primary: env.VITE_THEME_PRIMARY || basePreset.primary,
    primaryHover: env.VITE_THEME_PRIMARY_HOVER || basePreset.primaryHover,
  },

  // Feature Toggles (Enable / Disable per project)
  features: {
    multiLanguage: env.VITE_MULTI_LANGUAGE !== 'false',
    multiCurrency: env.VITE_MULTI_CURRENCY !== 'false',
    cashOnDelivery: true,         // Cash On Delivery checkout
    onlinePayment: false,         // Stripe remains deliberately disabled in the API.
    serialNumberTracking: true,   // Track individual item serial numbers
    orderReturns: true,           // Whole-order customer returns workflow
    liveInventoryUpdates: true,   // Real-time stock change notifications (SSE)
    savedAddresses: true,         // Customer address book
    invoices: true,               // Printable HTML invoice generation
    guestCheckout: true,          // Allow checkout without registration
  },

  // Future Modules (Displayed as clean placeholders in Platform Settings)
  futureModules: [
    { id: 'google_sso', name: 'Google Single-Sign-On (SSO)', status: 'Planned' },
    { id: 'customer_service', name: 'Customer Service Account & Helpdesk', status: 'Planned' },
    { id: 'ai_chatbot', name: 'AI Chatbot with NLP & Knowledge Base', status: 'Planned' },
    { id: 'logistics_portal', name: 'Logistics Partner Account & Portal', status: 'Planned' }
  ],

  // Localization Defaults & Supported Options
  i18n: {
    defaultLanguage: 'en',
    languages: [
      { code: 'en', label: 'English (EN)', shortLabel: 'EN', dir: 'ltr' },
      { code: 'ar', label: 'العربية (AR)', shortLabel: 'العربية', dir: 'rtl' }
    ],
    defaultCurrency: 'USD',
    supportedCurrencies: [
      { code: 'USD', symbol: '$', label: 'USD ($)' },
      { code: 'EUR', symbol: '€', label: 'EUR (€)' },
      { code: 'EGP', symbol: 'E£', label: 'EGP (E£)' },
      { code: 'SAR', symbol: 'SAR', label: 'SAR' },
      { code: 'AED', symbol: 'AED', label: 'AED' },
      { code: 'GBP', symbol: '£', label: 'GBP (£)' }
    ],
    defaultRates: {
      USD: 1,
      EUR: 0.92,
      EGP: 48.5,
      SAR: 3.75,
      AED: 3.67,
      GBP: 0.79
    }
  }
};
