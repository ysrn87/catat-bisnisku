'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';

interface InventoryReportTableProps {
  inventory: Array<{
    id: string;
    name: string;
    sku: string;
    stock: number;
    lowStock: number;
    cost: number;
    price: number;
    product: {
      name: string;
    };
  }>;
  currentPage: number;
  pageSize: number;
  totalItems: number;
}

export function InventoryReportTable({ 
  inventory, 
  currentPage, 
  pageSize, 
  totalItems 
}: InventoryReportTableProps) {
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
      <div className="overflow-x-auto text-[11px] sm:text-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className="text-right">Stock Value</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className='text-xs'>
            {inventory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No inventory data available
                </TableCell>
              </TableRow>
            ) : (
              inventory.map((item) => {
                const isLowStock = item.stock <= item.lowStock;
                const stockValue = Number(item.cost) * item.stock;
                
                return (
                  <TableRow key={item.id} className={isLowStock ? 'bg-red-50 text-[11px] sm:text-sm' : ' text-[11px] sm:text-sm'}>
                    <TableCell className="font-mono">{item.sku}</TableCell>
                    <TableCell className="truncate">{item.product.name}</TableCell>
                    <TableCell className="truncate">{item.name}</TableCell>
                    <TableCell>
                      <span className={isLowStock ? 'text-red-600 font-bold' : 'font-semibold'}>
                        {item.stock}
                      </span>
                    </TableCell>
                    <TableCell>{formatCurrency(Number(item.cost))}</TableCell>
                    <TableCell>{formatCurrency(Number(item.price))}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(stockValue)}
                    </TableCell>
                    <TableCell>
                      {isLowStock ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Stok Menipis
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Tersedia
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
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