'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Clock } from 'lucide-react';
import { StockAdjustmentDialog } from './stock-adjustment-dialog';
import { Pagination } from '@/components/ui/pagination';

interface StockItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  lowStock: number;
  product: {
    name: string;
    type: string;
  };
}

interface StockTableProps {
  stockItems: StockItem[];
  currentPage: number;
  pageSize: number;
  totalItems: number;
}

export function StockTable({
  stockItems,
  currentPage,
  pageSize,
  totalItems,
}: StockTableProps) {
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
              <TableHead>SKU</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead>Varian Produk</TableHead>
              <TableHead>Stok Tersedia</TableHead>
              <TableHead>Stok Min</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-xs">
            {stockItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Tidak ada produk tersedia
                </TableCell>
              </TableRow>
            ) : (
              stockItems.map((item) => {
                const isPreorder = item.product.type === 'PREORDER';
                const isLowStock = !isPreorder && item.stock <= item.lowStock;
                return (
                  <TableRow key={item.id} className={isPreorder ? 'bg-amber-50/40' : ''}>
                    <TableCell className="font-mono">{item.sku}</TableCell>
                    <TableCell>{item.product.name}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>
                      {isPreorder ? (
                        <span className="text-amber-600 font-medium">—</span>
                      ) : (
                        <span className={isLowStock ? 'text-red-600 font-bold' : ''}>
                          {item.stock}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isPreorder ? (
                        <span className="text-amber-500/60">—</span>
                      ) : (
                        item.lowStock
                      )}
                    </TableCell>
                    <TableCell>
                      {isPreorder ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          Pre Order
                        </span>
                      ) : isLowStock ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Stok menipis
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Tersedia
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isPreorder ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          Pre Order
                        </span>
                      ) : (
                        <StockAdjustmentDialog
                          variantId={item.id}
                          variantName={`${item.product.name} - ${item.name}`}
                          currentStock={item.stock}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-2">
        {stockItems.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Tidak ada produk tersedia</p>
          </div>
        ) : (
          stockItems.map((item) => {
            const isPreorder = item.product.type === 'PREORDER';
            const isLowStock = !isPreorder && item.stock <= item.lowStock;
            return (
              <div
                key={item.id}
                className={`border rounded-xl p-4 ${isPreorder ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-gray-200'}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{item.product.name}</p>
                    <p className="text-[10px] text-amber-500 font-medium mt-0.5">{item.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono">SKU: {item.sku}</p>
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    {isPreorder ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        <Clock className="w-3 h-3" />
                        Pre Order
                      </span>
                    ) : isLowStock ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-red-100 text-red-800">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Low
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-green-100 text-green-800">
                        OK
                      </span>
                    )}
                  </div>
                </div>

                {/* Stock Info */}
                <div className="grid grid-cols-2 gap-3 mb-2 pb-1 border-b border-gray-100">
                  <div>
                    <p className="text-[11px] text-gray-500">Stok Tersedia</p>
                    {isPreorder ? (
                      <p className="text-xs font-bold text-amber-500">—</p>
                    ) : (
                      <p className={`text-xs font-bold ${isLowStock ? 'text-red-600' : 'text-[#028697]'}`}>
                        {item.stock}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500">Stok Minimum</p>
                    {isPreorder ? (
                      <p className="text-xs font-bold text-amber-500/60">—</p>
                    ) : (
                      <p className="text-xs font-semibold text-gray-700">{item.lowStock}</p>
                    )}
                  </div>
                </div>

                {/* Action */}
                {isPreorder ? (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-600 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    Produk pre order — stok tidak dilacak
                  </div>
                ) : (
                  <StockAdjustmentDialog
                    variantId={item.id}
                    variantName={`${item.product.name} - ${item.name}`}
                    currentStock={item.stock}
                  />
                )}
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