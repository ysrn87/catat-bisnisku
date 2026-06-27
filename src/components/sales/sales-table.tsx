'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { SaleDetailsDialog } from './sale-details-dialog';
import { Pagination } from '@/components/ui/pagination';

interface SalesTableProps {
  sales: any[];
  currentPage: number;
  pageSize: number;
  totalItems: number;
  conversionRate?: number;
  userRole?: string;
  variants?: Array<{
    id: string;
    name: string;
    price: number;
    stock: number;
    pointsPerUnit: number;
    product: { name: string };
  }>;
}

const paymentStatusConfig: Record<string, { label: string; className: string }> = {
  PAID:    { label: 'Lunas',       className: 'bg-green-100 text-green-800' },
  PENDING: { label: 'Pending',     className: 'bg-yellow-100 text-yellow-800' },
  UNPAID:  { label: 'Belum Lunas', className: 'bg-red-100 text-red-800' },
};

export function SalesTable({ sales, currentPage, pageSize, totalItems, conversionRate = 1000, userRole, variants = [] }: SalesTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

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

  const handleViewDetails = (sale: any) => {
    setSelectedSale(sale);
    setShowDetailsDialog(true);
  };

  if (sales.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No sales yet</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sale ID #</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Cashier</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Pembayaran</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className='text-sm'>
            {sales.map((sale) => {
              const statusCfg = paymentStatusConfig[sale.paymentStatus] ?? paymentStatusConfig.PAID;
              return (
                <TableRow
                  key={sale.id}
                  className="cursor-pointer hover:bg-muted/60"
                  onClick={() => handleViewDetails(sale)}
                >
                  <TableCell className="font-medium truncate">{sale.saleNumber}</TableCell>
                  <TableCell className='truncate'>{formatDateTime(sale.createdAt)}</TableCell>
                  <TableCell className='truncate'>{sale.customerName || 'Pelanggan Umum'}</TableCell>
                  <TableCell className='truncate'>{sale.cashier.name}</TableCell>
                  <TableCell className='truncate'>{sale.items.reduce((sum: any, item: any) => sum + item.quantity, 0)} pc(s)</TableCell>
                  <TableCell>{formatCurrency(sale.total)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {sale.paymentMethod}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusCfg.className}`}>
                      {statusCfg.label}
                    </span>
                  </TableCell>
                  <TableCell className='truncate'>{sale.notes || '-'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-2">
        {sales.map((sale) => {
          const statusCfg = paymentStatusConfig[sale.paymentStatus] ?? paymentStatusConfig.PAID;
          const totalItems = sale.items.reduce((sum: any, item: any) => sum + item.quantity, 0);
          return (
            <div
              key={sale.id}
              onClick={() => handleViewDetails(sale)}
              className="bg-white border border-gray-200 rounded-xl p-4 active:bg-gray-50 transition-colors"
            >
              {/* Header Row */}
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold font-mono text-gray-900 truncate">{sale.saleNumber}</p>
                  <p className="text-[10px] text-gray-500">{formatDateTime(sale.createdAt)}</p>
                </div>
                <div className="ml-3 flex-shrink-0">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold ${statusCfg.className}`}>
                    {statusCfg.label}
                  </span>
                </div>
              </div>

              {/* Customer & Cashier */}
              <div className="space-y-2 mb-1">
                <div className="flex items-center text-sm pt-2">
                  <span className="font-medium text-gray-900 truncate max-w-[180px]">
                    {sale.customerName || 'Pelanggan Umum'}
                  </span>
                </div>
                <div className="flex items-center text-[11px]">
                  <span className="text-gray-500">Cashier:</span>
                  <span className="text-gray-900 truncate ml-2 max-w-[180px]">
                    {sale.cashier.name}
                  </span>
                </div>
              </div>

              {/* Amount & Details */}
              <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                    {sale.paymentMethod}
                  </span>
                  <span className="text-[11px] text-gray-500">{totalItems} pcs</span>
                </div>
                <div className="text-sm font-bold text-[#028697]">
                  {formatCurrency(sale.total)}
                </div>
              </div>
              

              {/* Note if exists */}
              {sale.notes && (
                <div className="mt-1 pt-1 border-t border-gray-100">
                  <p className="text-[11px] text-gray-600 line-clamp-2">
                    <span className="font-medium">Note:</span> {sale.notes}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {selectedSale && (
        <SaleDetailsDialog
          sale={selectedSale}
          conversionRate={conversionRate}
          userRole={userRole}
          variants={variants}
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
          onUpdate={() => window.location.reload()}
        />
      )}
    </>
  );
}