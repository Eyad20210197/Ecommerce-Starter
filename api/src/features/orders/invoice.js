import { escapeHtml as e } from '../../shared/security.js';
import { formatMoney } from '../../shared/money.js';
export function renderInvoice(order) {
  const money = value => e(formatMoney(value, order.currency));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(order.invoice_number)}</title>
  <style>body{font:16px/1.5 system-ui,sans-serif;color:#171717;max-width:850px;margin:48px auto;padding:0 24px}h1{font-size:28px}header{display:flex;justify-content:space-between;gap:24px}.muted{color:#555}table{width:100%;border-collapse:collapse;margin:32px 0}th,td{text-align:left;padding:12px 8px;border-bottom:1px solid #ddd}.right{text-align:right}footer{margin-top:32px} @media print{body{margin:0}} @media(max-width:550px){header{display:block}th,td{padding:8px 4px}}</style></head><body>
  <header><div><h1>${e(order.seller.name)}</h1><p>${e(order.seller.address)}<br>${e(order.seller.email)}${order.seller.taxId ? '<br>Tax ID: '+e(order.seller.taxId) : ''}</p></div>
  <div><h2>Invoice</h2><p>${e(order.invoice_number)}<br>Order #${e(order.number)}<br>${e(new Date(order.created_at).toISOString().slice(0,10))}</p></div></header>
  <p><strong>Bill to</strong><br>${e(order.contact.name)}<br>${e(order.contact.email)}<br>${e(order.contact.phone)}</p>
  <p><strong>Deliver to</strong><br>${e(order.address.name)}<br>${e(order.address.line1)} ${e(order.address.line2)}<br>${e(order.address.city)}, ${e(order.address.region)} ${e(order.address.postalCode)}<br>${e(order.address.country)}</p>
  <table><thead><tr><th>Item</th><th>Qty</th><th class="right">Unit price</th><th class="right">Amount</th></tr></thead><tbody>
  ${order.items.map(item => `<tr><td>${e(item.name)}<br><small class="muted">${e(item.sku)}${item.serials.length ? '<br>Serials: '+e(item.serials.join(', ')) : ''}</small></td><td>${item.quantity}</td><td class="right">${money(item.unit_price_minor)}</td><td class="right">${money(item.unit_price_minor*item.quantity)}</td></tr>`).join('')}
  </tbody></table><p class="right">Subtotal: ${money(order.subtotal_minor)}<br>Shipping: ${money(order.shipping_minor)}<br>Tax: ${money(order.tax_minor)}<br><strong>Total: ${money(order.total_minor)}</strong></p>
  <footer><p>Payment: ${e(order.payment_method === 'cod' ? 'Cash on delivery' : 'Online payment')} ? ${e(order.payment_status)}<br>Order status: ${e(order.status)}</p></footer></body></html>`;
}
