'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { upgradeToMemberAction } from '@/actions/customers';
import { UserCog, Loader2, Star, CheckCircle2 } from 'lucide-react';

interface UpgradeToMemberDialogProps {
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeToMemberDialog({ customer, open, onOpenChange }: UpgradeToMemberDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const result = await upgradeToMemberAction(customer.id);
      if (result.success) {
        toast({
          title: 'Berhasil diupgrade!',
          description: `${customer.name} sekarang menjadi Member dan bisa mengumpulkan poin.`,
        });
        onOpenChange(false);
      } else {
        toast({
          title: 'Gagal upgrade',
          description: result.error ?? 'Terjadi kesalahan.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Gagal upgrade',
        description: 'Permintaan tidak dapat diproses.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-[400px] p-0 gap-0 overflow-hidden border-0 shadow-2xl"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#028697] to-[#016d7a] px-6 pt-6 pb-8">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <UserCog className="w-5 h-5 text-white" />
            </div>
            <DialogHeader className="space-y-0.5 text-left p-0">
              <DialogTitle className="text-white text-lg font-semibold leading-tight">
                Upgrade ke Member
              </DialogTitle>
              <p className="text-white/65 text-xs font-normal">
                {customer.name} · {customer.phone}
              </p>
            </DialogHeader>
          </div>

          {/* Benefit pills */}
          <div className="relative mt-4 flex flex-wrap gap-2">
            {[
              { icon: Star, label: 'Mulai kumpulkan poin' },
              { icon: CheckCircle2, label: 'Akses portal member' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-full px-2.5 py-1"
              >
                <Icon className="w-3 h-3 text-white/80" />
                <span className="text-white/80 text-[10px] font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-gray-600 leading-relaxed">
            Pelanggan ini sudah punya akun sendiri. Upgrade akan mengubah status dari{' '}
            <span className="font-medium text-gray-800">Customer</span> menjadi{' '}
            <span className="font-medium text-[#028697]">Member</span>{' '}
            sehingga poin mulai dihitung dari transaksi berikutnya.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Tidak ada perubahan data profil. Pelanggan tetap login dengan akun mereka sendiri.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <Button
            onClick={handleUpgrade}
            disabled={loading}
            className="bg-[#028697] hover:bg-[#027080] text-white shadow-sm min-w-[150px] transition-all"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Memproses...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <UserCog className="w-3.5 h-3.5" />
                Upgrade ke Member
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
