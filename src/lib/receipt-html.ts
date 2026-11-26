import { formatCurrency, formatDateTime } from '@/lib/utils';
import { paymentMethodLabel } from '@/lib/payment';

/** Data struk — dipakai bersama oleh kasir (POS) dan modal detail penjualan. */
export interface ReceiptHtmlData {
  saleNumber: string;
  createdAt: Date | string;
  customerName: string;
  /** Label metode bayar yang sudah siap tampil (mis. "Tunai"). */
  paymentMethod: string;
  paymentStatus: string;
  items: Array<{ productName: string; variantName: string; quantity: number; price: number }>;
  /** Nilai harga di `combos` adalah per 1 paket; kalikan dengan `quantity`. */
  combos: Array<{
    name: string;
    quantity?: number;
    packagePrice: number;
    itemsTotal: number;
    discount: number;
    lines: Array<{ productName: string; variantName: string; price: number; quantity: number }>;
  }>;
  subtotal: number;
  comboDiscount: number;
  discount: number;
  pointDiscount: number;
  tax: number;
  ongkir: number;
  total: number;
  payments: Array<{ method: string; amount: number }>;
  cashReceived: number | null;
  changeAmount: number | null;
  pointsEarned: number;
}

/**
 * HTML struk thermal (58/80mm). Semua teks buatan pengguna di-escape karena jendela cetak
 * memakai document.write — HTML mentah di nama produk/toko bisa menjalankan skrip.
 */
export function buildReceiptHtml(receipt: ReceiptHtmlData, storeName: string, cashierName?: string): string {
  // Semua teks buatan pengguna (nama produk/toko/pelanggan) di-escape: jendela cetak
  // memakai document.write, jadi HTML mentah di nama produk bisa menjalankan skrip.
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const itemsHTML = receipt.items.map((item) => `
    <div class="item">
      <div class="item-name">${esc(item.productName)}${item.variantName !== item.productName ? ` – ${esc(item.variantName)}` : ''}</div>
      <div class="item-line">
        <span>${item.quantity} x ${formatCurrency(item.price)}</span>
        <span>${formatCurrency(item.price * item.quantity)}</span>
      </div>
    </div>
  `).join('');

  const combosHTML = receipt.combos.map((c) => `
    <div class="item">
      <div class="item-name"><strong>${esc(c.name)}${(c.quantity ?? 1) > 1 ? ` x${c.quantity}` : ''}</strong></div>
          ${(c.quantity ?? 1) > 1 ? `<div class="item-line" style="color:#666;"><span>&nbsp;&nbsp;Isi per paket:</span><span></span></div>` : ''}
      ${c.lines.map((l) => `
      <div class="item-line"><span>&nbsp;&nbsp;${esc(l.productName)}${l.variantName !== l.productName ? ` – ${esc(l.variantName)}` : ''}</span><span>${l.quantity} x ${formatCurrency(l.price)}</span></div>`).join('')}
      ${c.discount > 0 ? `<div class="item-line"><span>&nbsp;&nbsp;Diskon paket</span><span>- ${formatCurrency(c.discount * (c.quantity ?? 1))}</span></div>` : ''}
      <div class="item-line"><span>&nbsp;&nbsp;<strong>Harga paket</strong>${(c.quantity ?? 1) > 1 ? ` (${c.quantity} x ${formatCurrency(c.itemsTotal - c.discount)})` : ''}</span><span><strong>${formatCurrency((c.itemsTotal - c.discount) * (c.quantity ?? 1))}</strong></span></div>
    </div>
  `).join('');

  const summaryRows = [
    ['Subtotal', formatCurrency(receipt.subtotal), false],
    ...(receipt.comboDiscount > 0 ? [['Diskon Paket', `- ${formatCurrency(receipt.comboDiscount)}`, false]] : []),
    ...(receipt.discount > 0    ? [['Diskon',     `- ${formatCurrency(receipt.discount)}`,     false]] : []),
    ...(receipt.pointDiscount > 0 ? [['Tukar Poin', `- ${formatCurrency(receipt.pointDiscount)}`, false]] : []),
    ...(receipt.tax > 0         ? [['Pajak',      formatCurrency(receipt.tax),                 false]] : []),
    ...(receipt.ongkir > 0      ? [['Ongkir',     formatCurrency(receipt.ongkir),               false]] : []),
  ].map(([label, value]) => `
    <div class="summary-row"><span>${label}</span><span>${value}</span></div>
  `).join('');

  const paymentsHTML = [
    ...(receipt.payments.length > 1
      ? receipt.payments.map((p) => `<div class="summary-row"><span>${esc(paymentMethodLabel(p.method))}</span><span>${formatCurrency(p.amount)}</span></div>`)
      : []),
    ...(receipt.cashReceived !== null && receipt.changeAmount !== null
      ? [
          `<div class="summary-row"><span>Tunai diterima</span><span>${formatCurrency(receipt.cashReceived)}</span></div>`,
          `<div class="summary-row"><strong>Kembalian</strong><strong>${formatCurrency(receipt.changeAmount)}</strong></div>`,
        ]
      : []),
  ].join('');

  return `
  <!DOCTYPE html>
  <html lang="id">
  <head>
  <meta charset="UTF-8" />
  <title>Struk ${esc(receipt.saleNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #111;
  padding: 16px;
  max-width: 320px;
  margin: 0 auto;
    }
    .center  { text-align: center; }
    .store-name { font-size: 15px; font-weight: bold; }
    .meta    { font-size: 11px; color: #444; margin-top: 2px; }
    .divider { border-top: 1px dashed #999; margin: 10px 0; }
    .item    { margin-bottom: 6px; }
    .item-name { font-size: 12px; }
    .item-line { display: flex; justify-content: space-between; font-size: 12px; color: #333; }
    .summary-row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
    .total-row {
  display: flex; justify-content: space-between;
  font-size: 14px; font-weight: bold;
  border-top: 1px solid #111; margin-top: 6px; padding-top: 6px;
    }
    .footer  { text-align: center; font-size: 11px; color: #555; margin-top: 14px; }
    .btn-wrap { text-align: center; margin-top: 20px; }
    .btn {
  font-family: Arial, sans-serif;
  background: #028697; color: #fff; border: none;
  padding: 8px 20px; border-radius: 6px; font-size: 13px; cursor: pointer;
    }
    .btn.alt { background: #e5e7eb; color: #111; margin-left: 6px; }
    @page { margin: 4mm; }
    @media print {
  .btn-wrap { display: none; }
  body { padding: 0; }
    }
  </style>
  </head>
  <body>
    <div class="center">
  <div class="store-name">${esc(storeName)}</div>
  <div class="meta">${esc(receipt.saleNumber)}</div>
  <div class="meta">${formatDateTime(receipt.createdAt)}</div>
  ${cashierName ? `<div class="meta">Kasir: ${esc(cashierName)}</div>` : ''}
    </div>

    <div class="divider"></div>

    <div class="meta">Pelanggan: ${esc(receipt.customerName)}</div>
    <div class="meta">Bayar: ${esc(receipt.paymentMethod)}${receipt.paymentStatus === 'PENDING' ? ' (Pending)' : ''}</div>

    <div class="divider"></div>

    ${itemsHTML}
    ${combosHTML}

    <div class="divider"></div>

    ${summaryRows}
    <div class="total-row"><span>TOTAL</span><span>${formatCurrency(receipt.total)}</span></div>
    ${paymentsHTML}

    ${receipt.pointsEarned > 0 ? `<div class="footer">Poin didapat: ${receipt.pointsEarned}</div>` : ''}

    <div class="footer">Terima kasih atas kunjungan Anda 🙏</div>

    <div class="btn-wrap">
  <button class="btn" onclick="window.print()">Cetak Struk</button>
  <button class="btn alt" onclick="document.body.style.maxWidth='219px'">58mm</button>
  <button class="btn alt" onclick="document.body.style.maxWidth='302px'">80mm</button>
    </div>
  </body>
  </html>`;
}
