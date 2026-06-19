'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import { CashflowDialog } from '@/components/cashflow/cashflow-dialog';
import { deleteCashflowAction } from '@/actions/cashflow';
import { useToast } from '@/components/ui/use-toast';
import { useState } from 'react';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  category: string;
  description: string | null;
  date: Date;
  createdBy: { name: string };
}

interface CashflowTableProps {
  transactions: Transaction[];
  currentPage: number;
  pageSize: number;
  totalItems: number;
}

function DeleteButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!confirming) { setConfirming(true); return; }
    setLoading(true);
    const result = await deleteCashflowAction(id);
    if (result.success) {
      toast({ title: 'Transaksi dihapus' });
    } else {
      toast({ title: 'Gagal menghapus', description: result.error, variant: 'destructive' });
    }
    setLoading(false);
    setConfirming(false);
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      onBlur={() => setConfirming(false)}
      className={`p-1.5 rounded-lg transition-all text-xs ${
        confirming
          ? 'bg-red-100 text-red-600 font-semibold px-2'
          : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
      }`}
      title={confirming ? 'Klik lagi untuk konfirmasi' : 'Hapus'}
    >
      {confirming ? 'Yakin?' : <Trash2 className="w-3.5 h-3.5" />}
    </button>
  );
}

export function CashflowTable({ transactions, currentPage, pageSize, totalItems }: CashflowTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(totalItems / pageSize);

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    router.push(`?${params.toString()}`);
  };

  const handlePageSizeChange = (size: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('limit', size.toString());
    params.set('page', '1');
    router.push(`?${params.toString()}`);
  };

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead>Pencatat</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody className="text-xs">
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  Belum ada transaksi
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(t.date)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {t.type === 'INCOME' ? (
                        <><TrendingUp className="h-3.5 w-3.5 text-green-600" /><span className="text-green-600 font-medium">Pemasukan</span></>
                      ) : (
                        <><TrendingDown className="h-3.5 w-3.5 text-red-600" /><span className="text-red-600 font-medium">Pengeluaran</span></>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{t.category}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">{t.description || '—'}</TableCell>
                  <TableCell className="text-right">
                    <span className={`font-semibold ${t.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                      {t.type === 'INCOME' ? '+' : '−'}{formatCurrency(t.amount)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.createdBy.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <CashflowDialog
                        mode="edit"
                        transaction={{ ...t, type: t.type as 'INCOME' | 'EXPENSE', description: t.description ?? '', date: new Date(t.date) }}
                      />
                      <DeleteButton id={t.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">Belum ada transaksi</p>
          </div>
        ) : (
          transactions.map((t) => {
            const isIncome = t.type === 'INCOME';
            return (
              <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {isIncome
                      ? <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
                      : <TrendingDown className="h-4 w-4 text-red-600 shrink-0" />}
                    <div>
                      <p className={`text-sm font-bold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                        {isIncome ? 'Pemasukan' : 'Pengeluaran'}
                      </p>
                      <p className="text-xs text-gray-500">{formatDateTime(t.date)}</p>
                    </div>
                  </div>
                  <div className={`text-base font-bold shrink-0 ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                    {isIncome ? '+' : '−'}{formatCurrency(t.amount)}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Kategori</span>
                    <span className="font-medium text-gray-900">{t.category}</span>
                  </div>
                  {t.description && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500">{t.description}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-400">Pencatat: {t.createdBy.name}</p>
                    <div className="flex gap-1">
                      <CashflowDialog
                        mode="edit"
                        transaction={{ ...t, type: t.type as 'INCOME' | 'EXPENSE', description: t.description ?? '', date: new Date(t.date) }}
                      />
                      <DeleteButton id={t.id} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </>
  );
}
