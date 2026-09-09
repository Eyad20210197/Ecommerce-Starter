import { requireThat } from './errors.js';
export const fractionDigits = currency => new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
export function convertMinor(amount, currency, config) {
  requireThat(Object.hasOwn(config.rates, currency), 400, 'CURRENCY_UNAVAILABLE', 'This currency is unavailable.');
  const result = Math.round(amount * config.rates[currency] * 10 ** (fractionDigits(currency) - fractionDigits(config.CURRENCY)));
  requireThat(Number.isSafeInteger(result) && result >= 0 && result <= 2000000000, 400, 'AMOUNT_TOO_LARGE', 'Order amount is too large.');
  return result;
}
export const formatMoney = (minor, currency, language = 'en') => new Intl.NumberFormat(language, { style: 'currency', currency }).format(minor / 10 ** fractionDigits(currency));
