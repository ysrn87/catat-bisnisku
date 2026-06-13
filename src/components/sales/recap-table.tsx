'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, Package, ChevronLeft, ChevronRight } from 'lucide-react';

export interface RecapRow {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  totalQty: number;
  totalRevenue: number;
  avgPrice: number;
  totalTransactions: number;
}

interface RecapTableProps {
  rows: RecapRow[];
  pageSize?: number;
}

export function RecapTable({ rows, pageSize = 10 }: RecapTableProps) {
  const [page, setPage] = useState(1);

  const formatRupiah = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
        <Package className="w-10 h-10" />
        <p className="text-sm">Tidak ada data untuk filter yang dipilih.</p>
      </div>
    );
  }

  const maxQty = Math.max(...rows.map((r) => r.totalQty));
  const totalPages = Math.ceil(rows.length / pageSize);
  const paginated = rows.slice((page - 1) * pageSize, page * pageSize);
  const startIndex = (page - 1) * pageSize;

  return (
    <div className="space-y-3">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-xs truncate">
              <TableHead className="w-8">#</TableHead>
              <TableHead>Produk/Varian</TableHead>
              <TableHead className="text-right">Terjual</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Harga (Avg.)</TableHead>
              <TableHead className="text-right">Pendapatan</TableHead>
              <TableHead className="text-right">Transaksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((row, index) => {
              const isTop = row.totalQty === maxQty && maxQty > 0;
              return (
                <TableRow key={row.variantId} className="text-xs sm:text-sm">
                  <TableCell className="text-gray-400">
                    {startIndex + index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <div>
                        <div className="font-medium truncate">
                          {row.variantName}
                        </div>
                        <div className="text-gray-500 text-[10px] flex items-center gap-1.5 truncate">
                          {row.productName} - {row.sku}
                          <span>
                            {isTop && (
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {row.totalQty.toLocaleString('id-ID')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {row.sku}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-gray-600">
                    {formatRupiah(row.avgPrice)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-emerald-700">
                    {formatRupiah(row.totalRevenue)}
                  </TableCell>
                  <TableCell className="text-right text-gray-600">
                    {row.totalTransactions.toLocaleString('id-ID')}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {startIndex + 1}–{Math.min(page * pageSize, rows.length)} dari {rows.length} varian
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Button
              key={p}
              variant={p === page ? 'default' : 'outline'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(p)}
            >
              {p}
            </Button>
          ))}
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}