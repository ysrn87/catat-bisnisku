/**
 * lib/email.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Abstraksi pengiriman email menggunakan Resend.
 *
 * Setup:
 *   1. Daftar di https://resend.com (gratis: 3.000 email/bulan, 100/hari)
 *   2. Tambahkan dan verifikasi domain kamu di Resend Dashboard → Domains
 *   3. Buat API key di Resend Dashboard → API Keys
 *   4. Set env:
 *        RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
 *        RESEND_FROM_EMAIL=noreply@yourdomain.com
 *
 * Install:
 *   npm install resend
 *   npm uninstall nodemailer @types/nodemailer
 */

import { Resend } from 'resend';

// ─── Client (lazy singleton) ──────────────────────────────────────────────────

let _resend: Resend | null = null;

function getResend(): Resend {
  if (_resend) return _resend;

  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      '[email] RESEND_API_KEY belum diset di .env. ' +
      'Daftar di https://resend.com dan buat API key.'
    );
  }

  _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

function getFromEmail(): string {
  if (!process.env.RESEND_FROM_EMAIL) {
    throw new Error(
      '[email] RESEND_FROM_EMAIL belum diset di .env. ' +
      'Contoh: RESEND_FROM_EMAIL=noreply@yourdomain.com'
    );
  }
  return process.env.RESEND_FROM_EMAIL;
}

// ─── Core send ───────────────────────────────────────────────────────────────

interface SendEmailOptions {
  to:      string;
  subject: string;
  html:    string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  const resend = getResend();
  const from   = getFromEmail();

  const { error } = await resend.emails.send({ from, to, subject, html });

  if (error) {
    throw new Error(`[email] Resend error: ${error.message}`);
  }
}

// ─── App URL helper ───────────────────────────────────────────────────────────

export function getAppUrl(): string {
  return process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CatatBisnisku</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:#028697;padding:24px 32px;">
              <span style="color:#ffffff;font-size:20px;font-weight:bold;">CatatBisnisku</span>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background:#f9f9f9;border-top:1px solid #eee;">
              <p style="margin:0;font-size:12px;color:#888;">
                Email ini dikirim otomatis oleh CatatBisnisku. Jangan balas email ini.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `
<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="background:#028697;border-radius:6px;">
      <a href="${href}" style="display:inline-block;padding:12px 28px;color:#ffffff;
        font-size:15px;font-weight:bold;text-decoration:none;">${label}</a>
    </td>
  </tr>
</table>`;
}

// ─── Template: Verifikasi Email ───────────────────────────────────────────────

export function emailVerificationTemplate(params: {
  name:  string;
  link:  string;
}): { subject: string; html: string } {
  return {
    subject: 'Verifikasi email kamu — CatatBisnisku',
    html: baseTemplate(`
      <p style="margin:0 0 8px;font-size:16px;color:#111;">Halo, <strong>${params.name}</strong>!</p>
      <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.6;">
        Terima kasih sudah mendaftar di CatatBisnisku. Klik tombol di bawah untuk
        memverifikasi email kamu dan mulai menggunakan aplikasi.
      </p>
      ${ctaButton(params.link, 'Verifikasi Email')}
      <p style="margin:0;font-size:12px;color:#888;">
        Link ini berlaku selama <strong>24 jam</strong>. Jika kamu tidak mendaftar,
        abaikan email ini.
      </p>
      <p style="margin:12px 0 0;font-size:12px;color:#aaa;">
        Atau copy link ini ke browser:<br>
        <span style="color:#028697;">${params.link}</span>
      </p>
    `),
  };
}

// ─── Template: Undangan Staff (user sudah terdaftar) ─────────────────────────

export function staffInvitationExistingUserTemplate(params: {
  name:        string;
  storeName:   string;
  inviterName: string;
  role:        string;
  acceptLink:  string;
  declineLink: string;
  expiresIn:   string;
}): { subject: string; html: string } {
  const roleLabel: Record<string, string> = {
    MANAGER:  'Manager',
    CASHIER:  'Kasir',
    ADMINISTRATOR: 'Administrator',
  };

  return {
    subject: `Undangan bergabung ke ${params.storeName} — CatatBisnisku`,
    html: baseTemplate(`
      <p style="margin:0 0 8px;font-size:16px;color:#111;">Halo, <strong>${params.name}</strong>!</p>
      <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.6;">
        <strong>${params.inviterName}</strong> mengundang kamu untuk bergabung ke toko
        <strong>${params.storeName}</strong> sebagai <strong>${roleLabel[params.role] ?? params.role}</strong>.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td style="background:#028697;border-radius:6px;margin-right:8px;">
            <a href="${params.acceptLink}" style="display:inline-block;padding:12px 24px;color:#ffffff;
              font-size:15px;font-weight:bold;text-decoration:none;">✓ Terima Undangan</a>
          </td>
          <td style="width:12px;"></td>
          <td style="background:#ffffff;border-radius:6px;border:1px solid #ddd;">
            <a href="${params.declineLink}" style="display:inline-block;padding:12px 24px;color:#555;
              font-size:15px;text-decoration:none;">✗ Tolak</a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:12px;color:#888;">
        Undangan ini berlaku selama <strong>${params.expiresIn}</strong>.
        Jika kamu tidak mengenal pengirim, abaikan email ini.
      </p>
    `),
  };
}

// ─── Template: Undangan Staff (user belum terdaftar) ─────────────────────────

export function staffInvitationNewUserTemplate(params: {
  storeName:    string;
  inviterName:  string;
  role:         string;
  registerLink: string;
  expiresIn:    string;
}): { subject: string; html: string } {
  const roleLabel: Record<string, string> = {
    MANAGER:  'Manager',
    CASHIER:  'Kasir',
    ADMINISTRATOR: 'Administrator',
  };

  return {
    subject: `Kamu diundang ke ${params.storeName} — CatatBisnisku`,
    html: baseTemplate(`
      <p style="margin:0 0 8px;font-size:16px;color:#111;">Halo!</p>
      <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.6;">
        <strong>${params.inviterName}</strong> mengundang kamu untuk bergabung ke toko
        <strong>${params.storeName}</strong> sebagai <strong>${roleLabel[params.role] ?? params.role}</strong>
        di CatatBisnisku.
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.6;">
        Buat akun gratis kamu untuk menerima undangan ini:
      </p>
      ${ctaButton(params.registerLink, 'Buat Akun & Terima Undangan')}
      <p style="margin:0;font-size:12px;color:#888;">
        Undangan ini berlaku selama <strong>${params.expiresIn}</strong>.
        Jika kamu tidak mengenal pengirim, abaikan email ini.
      </p>
    `),
  };
}

// ─── Template: Konfirmasi Ganti Email ────────────────────────────────────────

export function emailChangeConfirmationTemplate(params: {
  name:     string;
  oldEmail: string;
  newEmail: string;
  link:     string;
}): { subject: string; html: string } {
  return {
    subject: 'Konfirmasi perubahan email — CatatBisnisku',
    html: baseTemplate(`
      <p style="margin:0 0 8px;font-size:16px;color:#111;">Halo, <strong>${params.name}</strong>!</p>
      <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.6;">
        Kami menerima permintaan untuk mengganti email akun kamu dari
        <strong>${params.oldEmail}</strong> ke <strong>${params.newEmail}</strong>.
        Klik tombol di bawah untuk mengonfirmasi email baru ini.
      </p>
      ${ctaButton(params.link, 'Konfirmasi Email Baru')}
      <p style="margin:0;font-size:12px;color:#888;">
        Link ini berlaku selama <strong>1 jam</strong>. Sebelum dikonfirmasi,
        kamu tetap login menggunakan email lama. Jika kamu tidak meminta
        perubahan ini, abaikan email ini dan email lama akan tetap aktif.
      </p>
      <p style="margin:12px 0 0;font-size:12px;color:#aaa;">
        Atau copy link ini ke browser:<br>
        <span style="color:#028697;">${params.link}</span>
      </p>
    `),
  };
}
