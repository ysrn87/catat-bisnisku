'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { backfillJournalsAction } from '@/actions/backfill-journals';
import { RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';

export function BackfillJournalsButton() {
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const { toast } = useToast();

  const handleBackfill = async () => {
    setLoading(true);
    try {
      const result = await backfillJournalsAction();
      if (result.success) {
        setDone(true);
        toast({
          title:       'Backfill Selesai',
          description: result.message,
        });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast({
          title:       'Gagal',
          description: result.error,
          variant:     'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle2 className="w-4 h-4" />
        Backfill selesai, memuat ulang...
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 text-xs"
      onClick={handleBackfill}
      disabled={loading}
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <RefreshCw className="w-3.5 h-3.5" />
      }
      {loading ? 'Memproses...' : 'Sync Data Historis ke Jurnal'}
    </Button>
  );
}
