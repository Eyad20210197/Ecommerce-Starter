/**
 * Formatting utilities for Money, Dates, and Localized Content
 */

export const digits = currency => {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
};

export function formatMoney(amount, currency = 'USD', rates = {}, baseCurrency = 'USD', language = 'en', convert = false) {
  let val = Number(amount) || 0;
  const targetDigits = digits(currency);
  const baseDigits = digits(baseCurrency);

  if (convert && rates && rates[currency] && rates[baseCurrency]) {
    const rate = rates[currency] / rates[baseCurrency];
    val = Math.round(val * rate * 10 ** (targetDigits - baseDigits));
  }

  const denominator = 10 ** targetDigits;
  try {
    return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
      style: 'currency',
      currency
    }).format(val / denominator);
  } catch {
    return `${currency} ${(val / denominator).toFixed(targetDigits)}`;
  }
}

export function formatDate(value, language = 'en') {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return String(value);
  }
}

export function productName(product, language = 'en') {
  if (!product) return '';
  if (language === 'ar' && product.translations?.ar?.name) {
    return product.translations.ar.name;
  }
  return product.name || '';
}

export function productDescription(product, language = 'en') {
  if (!product) return '';
  if (language === 'ar' && product.translations?.ar?.description) {
    return product.translations.ar.description;
  }
  return product.description || '';
}

export function categoryName(category, language = 'en') {
  if (!category) return '';
  if (language === 'ar' && category.translations?.ar) {
    return category.translations.ar;
  }
  return category.name || '';
}
