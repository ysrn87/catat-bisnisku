'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  getSalesExportData,
  getInventoryExportData,
  getCashflowExportData,
} from '@/actions/export';

type ExportType = 'sales' | 'inventory' | 'cashflow';

interface ExportButtonProps {
  type:  ExportType;
  label?: string;
}

const labels: Record<ExportType, string> = {
  sales:     'Export Penjualan',
  inventory: 'Export Inventori',
  cashflow:  'Export Cashflow',
};

/**
 * Tombol export Excel menggunakan SheetJS (xlsx).
 * Hanya ditampilkan untuk plan PRO — bungkus dengan PlanGate di parent.
 *
 * Flow:
 *   Klik → panggil server action → dapat array of objects
 *   → buat workbook SheetJS → download sebagai .xlsx
 */
export function ExportButton({ type, label }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setLoading(true);
    try {
      // 1. Ambil data dari server
      let result: { success: boolean; data?: Record<string, unknown>[]; filename?: string; error?: string };
      if (type === 'sales')     result = await getSalesExportData();
      else if (type === 'inventory') result = await getInventoryExportData();
      else result = await getCashflowExportData();

      if (!result.success || !result.data) {
        toast({ title: 'Gagal export', description: result.error, variant: 'destructive' });
        return;
      }

      if (result.data.length === 0) {
        toast({ title: 'Tidak ada data', description: 'Belum ada data untuk diexport.' });
        return;
      }

      // 2. Load SheetJS secara dinamis (tidak perlu install — pakai CDN)
      const XLSX = await import('xlsx');

      // 3. Buat worksheet dari array of objects
      const ws = XLSX.utils.json_to_sheet(result.data);

      // Auto-width kolom
      const cols = Object.keys(result.data[0]).map((key) => ({
        wch: Math.max(
          key.length,
          ...result.data!.map((row) => String(row[key] ?? '').length)
        ) + 2,
      }));
      ws['!cols'] = cols;

      // 4. Buat workbook dan download
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Laporan');
      XLSX.writeFile(wb, `${result.filename}.xlsx`);

      toast({ title: 'Export berhasil', description: `${result.data.length} baris berhasil diexport.` });

    } catch (error) {
      console.error('[ExportButton]', error);
      toast({ title: 'Gagal export', description: 'Terjadi kesalahan. Coba lagi.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      className="gap-1.5 border-[#028697] text-[#028697] hover:bg-[#028697]/5"
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <FileDown className="w-3.5 h-3.5" />
      }
      {loading ? 'Mengexport...' : (label ?? labels[type])}
    </Button>
  );
}
