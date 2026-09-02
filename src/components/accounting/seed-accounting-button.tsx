'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { seedAccountingForCurrentStore } from '@/actions/accounting';
import { Database, CheckCircle, Loader2 } from 'lucide-react';

export function SeedAccountingButton() {
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const { toast } = useToast();

  const handleSeed = async () => {
    setLoading(true);
    try {
      const result = await seedAccountingForCurrentStore();
      if (result.success) {
        setDone(true);
        toast({
          title:       'Berhasil',
          description: result.message ?? 'Chart of Accounts berhasil dibuat',
        });
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast({
          title:       'Gagal',
          description: result.error ?? 'Gagal membuat Chart of Accounts',
          variant:     'destructive',
        });
      }
    } catch {
      toast({
        title:       'Error',
        description: 'Terjadi kesalahan',
        variant:     'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle className="w-4 h-4" />
        Chart of Accounts berhasil dibuat, memuat ulang...
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
      onClick={handleSeed}
      disabled={loading}
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <Database className="w-3.5 h-3.5" />
      }
      {loading ? 'Membuat akun...' : 'Inisialisasi Chart of Accounts'}
    </Button>
  );
}
