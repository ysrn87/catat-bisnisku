'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';

interface CashflowTableProps {
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    category: string;
    description: string | null;
    date: Date;
    createdBy: {
      name: string;
    };
  }>;
  currentPage: number;
  pageSize: number;
  totalItems: number;
}

export function CashflowTable({ 
  transactions, 
  currentPage, 
  pageSize, 
  totalItems 
}: CashflowTableProps) {
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
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead>Recorder</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className='text-xs'>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Belum ada transaksi
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>
                    {formatDateTime(transaction.date)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {transaction.type === 'INCOME' ? (
                        <>
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-green-600 font-medium">Pemasukan</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-4 w-4 text-red-600" />
                          <span className="text-red-600 font-medium">Pengeluaran</span>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{transaction.category}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {transaction.description || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={transaction.type === 'INCOME' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                      {transaction.type === 'INCOME' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {transaction.createdBy.name}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Belum ada transaksi</p>
          </div>
        ) : (
          transactions.map((transaction) => {
            const isIncome = transaction.type === 'INCOME';
            return (
              <div key={transaction.id} className="bg-white border border-gray-200 rounded-xl p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {isIncome ? (
                      <TrendingUp className="h-5 w-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-600 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className={`text-sm font-bold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                        {isIncome ? 'Pemasukan' : 'Pengeluaran'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(transaction.date)}
                      </p>
                    </div>
                  </div>
                  <div className={`text-base font-bold flex-shrink-0 ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 text-xs">Kategori:</span>
                    <span className="font-medium text-gray-900">{transaction.category}</span>
                  </div>
                  {transaction.description && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-600">{transaction.description}</p>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500">Recorder: {transaction.createdBy.name}</p>
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