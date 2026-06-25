'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';

interface PointHistory {
  id: string;
  delta: number;
  description: string;
  createdAt: Date;
}

interface PointsHistoryTableProps {
  pointsHistory: PointHistory[];
  currentPage: number;
  pageSize: number;
  totalItems: number;
}

export function PointsHistoryTable({ 
  pointsHistory, 
  currentPage, 
  pageSize, 
  totalItems 
}: PointsHistoryTableProps) {
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
      {pointsHistory.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No points activity yet</p>
      ) : (
        <>
          <div className="space-y-4 text-xs">
            {pointsHistory.map((history) => (
              <div
                key={history.id}
                className="flex items-center justify-between border-b pb-4 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${history.delta > 0
                      ? 'bg-green-100 text-green-600'
                      : 'bg-red-100 text-red-600'
                      }`}
                  >
                    {history.delta > 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{history.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(history.createdAt)}
                    </p>
                  </div>
                </div>
                <div
                  className={`text-lg font-bold ${history.delta > 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                >
                  {history.delta > 0 ? '+' : ''}
                  {history.delta}
                </div>
              </div>
            ))}
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
      )}
    </>
  );
}
