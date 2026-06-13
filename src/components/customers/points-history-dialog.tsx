'use client';

import { useState, useEffect, useCallback } from 'react';
import { Award, TrendingUp, TrendingDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';
import { getCustomerPointsHistory } from '@/actions/members';

interface PointHistory {
  id: string;
  points: number;
  description: string;
  createdAt: Date;
}

interface PointsHistoryDialogProps {
  customerId: string;
  customerName: string;
  currentPoints: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAGE_SIZE = 10;

export function PointsHistoryDialog({
  customerId,
  customerName,
  currentPoints,
  open,
  onOpenChange,
}: PointsHistoryDialogProps) {
  const [history, setHistory] = useState<PointHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchHistory = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCustomerPointsHistory(customerId, p, PAGE_SIZE);
      setHistory(result.history);
      setTotal(result.total);
    } catch (e) {
      setError('Failed to load points history.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (open) {
      setPage(1);
      fetchHistory(1);
    }
  }, [open, fetchHistory]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchHistory(newPage);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-600" />
            Riwayat Poin
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{customerName}</span>
            &nbsp;— Saldo saat ini:{' '}
            <span className="font-bold text-yellow-600">{currentPoints} poin</span>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Memuat...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-destructive text-sm">
              {error}
            </div>
          ) : history.length === 0 ? (
            <p className="text-muted-foreground text-center py-12 text-sm">
              Belum ada aktivitas poin.
            </p>
          ) : (
            <div className="space-y-3 text-xs">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full ${
                        item.points > 0
                          ? 'bg-green-100 text-green-600'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {item.points > 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`text-base font-bold ${
                      item.points > 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {item.points > 0 ? '+' : ''}
                    {item.points}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
            <span>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} dari {total}
            </span>
            <div className="flex gap-1">
              <button
                className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-muted transition-colors"
                disabled={page === 1}
                onClick={() => handlePageChange(page - 1)}
              >
                ‹ Prev
              </button>
              <button
                className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-muted transition-colors"
                disabled={page === totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}