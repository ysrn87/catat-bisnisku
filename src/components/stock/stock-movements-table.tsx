'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { formatDateTime } from '@/lib/utils';
import { TrendingUp, TrendingDown, Package } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';

interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  notes: string | null;
  createdAt: Date;
  variant: {
    name: string;
    product: {
      name: string;
    };
  };
}

interface StockMovementsTableProps {
  movements: StockMovement[];
  currentPage: number;
  pageSize: number;
  totalItems: number;
}

export function StockMovementsTable({ 
  movements, 
  currentPage, 
  pageSize, 
  totalItems 
}: StockMovementsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const totalPages = Math.ceil(totalItems / pageSize);

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('movementPage', page.toString());
    router.push(`?${params.toString()}`);
  };

  const handlePageSizeChange = (size: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('movementLimit', size.toString());
    params.set('movementPage', '1');
    router.push(`?${params.toString()}`);
  };

  return (
    <>
      <div className="space-y-4">
        {movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada riwayat tercatat</p>
        ) : (
          movements.map((movement) => (
            <div key={movement.id} className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                <div>
                  {movement.type === 'IN' ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : movement.type === 'OUT' ? (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  ) : (
                    <Package className="h-5 w-5 text-blue-600" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium flex-auto break-words line-clamp-2">
                    {movement.variant.product.name} - {movement.variant.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {movement.type} • {movement.quantity} units
                    {movement.notes && ` • ${movement.notes}`}
                  </p>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground text-right'>
                    {formatDateTime(movement.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {movements.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </>
  );
}
