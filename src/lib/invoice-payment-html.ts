// ─────────────────────────────────────────────────────────────────────────────
// Blok "Informasi Pembayaran" untuk invoice cetak (HTML string).
// Semua teks buatan admin di-escape — invoice ditulis ke jendela cetak lewat
// document.write, jadi nilai yang tidak di-escape = celah XSS.
// ─────────────────────────────────────────────────────────────────────────────

import {
  displayableAccounts,
  ewalletColor,
  isSafeBlobUrl,
  type PaymentAccountInfo,
} from '@/lib/payment-accounts';

function esc(v: string | null | undefined): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** CSS tambahan untuk blok pembayaran (disisipkan ke <style> invoice). */
export const INVOICE_PAYMENT_CSS = `
          .bank-account + .bank-account {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px dashed var(--line);
          }
          .qris-section { margin-top: 12px; }
          .qris-grid { display: flex; flex-wrap: wrap; gap: 14px; }
          .qris-item { text-align: center; }
          .qris-item img {
            display: block;
            width: 130px;
            height: 130px;
            object-fit: contain;
            background: #fff;
            border: 1px solid var(--line);
            border-radius: 6px;
            padding: 4px;
          }
          .qris-label { font-size: 10px; color: var(--muted); margin-top: 4px; }
          .payment-info { break-inside: avoid; page-break-inside: avoid; }
`;

/** Kembalikan string kosong bila tidak ada akun aktif — blok disembunyikan sepenuhnya. */
export function buildInvoicePaymentInfoHtml(accounts: PaymentAccountInfo[]): string {
  const banks    = displayableAccounts(accounts, 'BANK');
  const ewallets = displayableAccounts(accounts, 'EWALLET');
  const qris     = displayableAccounts(accounts, 'QRIS').filter((a) => isSafeBlobUrl(a.qrisImageUrl));

  if (banks.length === 0 && ewallets.length === 0 && qris.length === 0) return '';

  const bankCol = banks.length === 0 ? '' : `
            <div>
              <div class="payment-col-title">Transfer Bank</div>
              ${banks.map((b) => `
              <div class="bank-account">
                <div class="bank-row"><span class="label">Bank</span><span class="value">${esc(b.provider)}</span></div>
                <div class="bank-row"><span class="label">No. Rekening</span><span class="value">${esc(b.accountNumber)}</span></div>
                <div class="bank-row"><span class="label">Atas Nama</span><span class="value">${esc(b.accountName)}</span></div>
              </div>`).join('')}
            </div>`;

  const ewalletCol = ewallets.length === 0 ? '' : `
            <div>
              <div class="payment-col-title">E-Wallet</div>
              ${ewallets.map((w) => `
              <div class="ewallet-row">
                <span class="ewallet-badge" style="background:${esc(ewalletColor(w.provider))};color:#fff">${esc(w.provider)}</span>
                <span class="ewallet-number">${esc(w.accountNumber)}</span>
                <span class="ewallet-name">${esc(w.accountName)}</span>
              </div>`).join('')}
            </div>`;

  const columns = [bankCol, ewalletCol].filter(Boolean);
  const grid = columns.length === 0 ? '' : `
          <div class="payment-grid"${columns.length === 1 ? ' style="grid-template-columns:1fr"' : ''}>${columns.join('')}
          </div>`;

  const qrisSection = qris.length === 0 ? '' : `
          <div class="qris-section">
            <div class="payment-col-title">QRIS</div>
            <div class="qris-grid">
              ${qris.map((q) => `
              <div class="qris-item">
                <img src="${esc(q.qrisImageUrl)}" alt="QRIS ${esc(q.provider)}">
                <div class="qris-label">${esc(q.provider)}</div>
              </div>`).join('')}
            </div>
          </div>`;

  return `
        <!-- Payment Info: diambil dari Pengaturan › Pembayaran -->
        <div class="payment-info">
          <div class="payment-info-label">Informasi Pembayaran</div>${grid}${qrisSection}
        </div>
`;
}
