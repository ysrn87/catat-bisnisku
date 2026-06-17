/**
 * Utility sanitasi input teks untuk server actions.
 *
 * Tujuan:
 * - Cegah XSS dengan strip HTML tags dari input teks bebas
 * - Normalisasi whitespace berlebih
 * - Batasi panjang field sesuai konteks
 *
 * Next.js + React sudah escape HTML di render secara default,
 * tapi sanitasi di server tetap penting sebagai defense-in-depth:
 * - Melindungi kalau ada komponen yang pakai dangerouslySetInnerHTML
 * - Melindungi data yang di-export ke Excel/PDF
 * - Melindungi notifikasi/email yang render HTML
 */

/** Strip semua HTML tags dan normalisasi whitespace */
function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')       // hapus HTML tags
    .replace(/&[a-z]+;/gi, ' ')    // hapus HTML entities (e.g. &amp; &lt;)
    .replace(/\s+/g, ' ')          // normalisasi multiple spaces/newlines
    .trim();
}

/**
 * Sanitasi field nama — strip HTML, trim, batasi panjang.
 * @param value  Raw input dari formData
 * @param max    Panjang maksimal (default 100)
 */
export function sanitizeName(value: string | null | undefined, max = 100): string {
  if (!value) return '';
  return stripHtml(value).slice(0, max);
}

/**
 * Sanitasi field teks bebas (notes, description, address).
 * Izinkan newline tapi strip HTML.
 * @param value  Raw input dari formData
 * @param max    Panjang maksimal (default 500)
 */
export function sanitizeText(value: string | null | undefined, max = 500): string {
  if (!value) return '';
  return value
    .replace(/<[^>]*>/g, '')       // hapus HTML tags
    .replace(/&[a-z]+;/gi, ' ')    // hapus HTML entities
    .replace(/[ \t]+/g, ' ')       // normalisasi spasi horizontal (biarkan newline)
    .trim()
    .slice(0, max);
}

/**
 * Sanitasi SKU/kode — hanya izinkan alphanumeric, dash, underscore, titik.
 */
export function sanitizeSku(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/[^a-zA-Z0-9\-_.]/g, '')
    .toUpperCase()
    .slice(0, 50);
}

/**
 * Sanitasi slug toko — hanya izinkan a-z, 0-9, dash.
 */
export function sanitizeSlug(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')          // hapus double dash
    .replace(/^-|-$/g, '')         // hapus dash di awal/akhir
    .slice(0, 50);
}

/**
 * Sanitasi kategori cashflow — strip HTML, trim, max 50 karakter.
 */
export function sanitizeCategory(value: string | null | undefined): string {
  if (!value) return '';
  return stripHtml(value).slice(0, 50);
}
