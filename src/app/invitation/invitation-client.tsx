'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { respondInvitationAction } from '@/actions/team-actions';

type Status =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'not-found'
  | 'wrong-account';

interface Props {
  status:           Status;
  token?:           string;
  autoAccept?:      boolean;
  storeName?:       string;
  storeLogoUrl?:    string;
  inviterName?:     string;
  role?:            string;
  invitationEmail?: string;
  currentEmail?:    string;
}

export default function InvitationClient({
  status,
  token,
  autoAccept,
  storeName,
  storeLogoUrl,
  inviterName,
  role,
  invitationEmail,
  currentEmail,
}: Props) {
  const router                  = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult]     = useState<Status>(status);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (autoAccept && status === 'pending' && token) {
      handleRespond(true);
    }
  }, []);

  function handleRespond(accept: boolean) {
    if (!token) return;
    startTransition(async () => {
      const res = await respondInvitationAction(token, accept);
      if (res.success) {
        setResult(accept ? 'accepted' : 'declined');
        if (accept && res.storeSlug) {
          setTimeout(() => router.push(`/${res.storeSlug}/admin`), 1500);
        }
      } else {
        setError(res.error ?? 'Terjadi kesalahan.');
      }
    });
  }

  // ── Render states ────────────────────────────────────────────────────────────

  if (result === 'accepted') {
    return (
      <InvitationLayout>
        <div className="text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Undangan diterima!</h1>
          <p className="text-gray-500 text-sm">Mengalihkan ke dashboard toko…</p>
        </div>
      </InvitationLayout>
    );
  }

  if (result === 'declined') {
    return (
      <InvitationLayout>
        <div className="text-center">
          <div className="text-5xl mb-4">👋</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Undangan ditolak</h1>
          <p className="text-gray-500 text-sm">Kamu bisa menutup halaman ini.</p>
        </div>
      </InvitationLayout>
    );
  }

  if (result === 'expired') {
    return (
      <InvitationLayout>
        <div className="text-center">
          <div className="text-5xl mb-4">⏰</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Undangan kedaluwarsa</h1>
          <p className="text-gray-500 text-sm">Minta pemilik toko untuk mengirim ulang undangan.</p>
        </div>
      </InvitationLayout>
    );
  }

  if (result === 'not-found') {
    return (
      <InvitationLayout>
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Undangan tidak ditemukan</h1>
          <p className="text-gray-500 text-sm">Link undangan tidak valid atau sudah digunakan.</p>
        </div>
      </InvitationLayout>
    );
  }

  if (result === 'wrong-account') {
    return (
      <InvitationLayout>
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Akun tidak sesuai</h1>
          <p className="text-gray-500 text-sm mb-1">
            Undangan ini ditujukan untuk <strong>{invitationEmail}</strong>.
          </p>
          <p className="text-gray-500 text-sm">
            Kamu sedang login sebagai <strong>{currentEmail}</strong>.
          </p>
          <p className="text-gray-400 text-xs mt-3">
            Logout lalu login dengan akun yang benar untuk menerima undangan ini.
          </p>
        </div>
      </InvitationLayout>
    );
  }

  // ── Pending (default) ────────────────────────────────────────────────────────
  return (
    <InvitationLayout>
      <div className="text-center mb-6">
        {storeLogoUrl ? (
          <img src={storeLogoUrl} alt={storeName} className="w-16 h-16 rounded-xl mx-auto mb-3 object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-teal-100 flex items-center justify-center mx-auto mb-3 text-2xl">
            🏪
          </div>
        )}
        <h1 className="text-xl font-semibold text-gray-900">{storeName}</h1>
        <p className="text-gray-500 text-sm mt-1">
          <strong>{inviterName}</strong> mengundang kamu sebagai <strong>{role}</strong>
        </p>
      </div>

      {error && (
        <p className="text-red-600 text-sm text-center mb-4 bg-red-50 rounded-lg p-3">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => handleRespond(true)}
          disabled={isPending}
          className="flex-1 bg-teal-600 text-white rounded-lg py-2.5 font-medium
            hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Memproses…' : 'Terima'}
        </button>
        <button
          onClick={() => handleRespond(false)}
          disabled={isPending}
          className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 font-medium
            hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Tolak
        </button>
      </div>
    </InvitationLayout>
  );
}

function InvitationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <span className="text-sm font-semibold text-teal-700">CatatBisnisku</span>
        </div>
        {children}
      </div>
    </div>
  );
}
