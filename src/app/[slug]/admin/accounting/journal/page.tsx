import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DateRangeFilter } from '@/components/accounting/date-range-filter';
import { formatCurrency } from '@/lib/utils';
import { BookOpen } from 'lucide-react';

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const p = await searchParams;
  const { storeId } = await getStoreContext();

  const page  = Number(p.page) || 1;
  const limit = 20;
  const skip  = (page - 1) * limit;

  const dateFilter: any = {};
  if (p.dateFrom) dateFilter.gte = new Date(p.dateFrom);
  if (p.dateTo)   dateFilter.lte = new Date(p.dateTo + 'T23:59:59');

  const where = {
    storeId,
    ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
  };

  const [entries, total] = await Promise.all([
    db.journalEntry.findMany({
      where,
      include: {
        debit:  { select: { code: true, name: true } },
        credit: { select: { code: true, name: true } },
      },
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    }),
    db.journalEntry.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  // Total debit & kredit untuk validasi balance
  const agg = await db.journalEntry.aggregate({
    where,
    _sum: { amount: true },
  });
  const totalAmount = Number(agg._sum.amount || 0);

  return (
    <div className="space-y-5">

      {/* Filter */}
      <DateRangeFilter defaultFrom={p.dateFrom} defaultTo={p.dateTo} />

      {/* Info bar */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {total} entri jurnal
        </span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
          D = Debit
          <span className="w-2 h-2 rounded-full bg-rose-400 inline-block ml-2" />
          K = Kredit
        </div>
      </div>

      {/* Tabel jurnal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-muted-foreground" />
            Jurnal Umum
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-sm text-muted-foreground">Belum ada jurnal pada periode ini.</p>
              <p className="text-xs text-muted-foreground">
                Jurnal terbuat otomatis dari setiap transaksi penjualan dan cashflow.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 space-y-2 hover:bg-gray-50 transition-colors"
                >
                  {/* Header baris */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.date).toLocaleDateString('id-ID', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          entry.sourceType === 'POS_SALE'
                            ? 'border-blue-200 text-blue-600 bg-blue-50'
                            : 'border-amber-200 text-amber-600 bg-amber-50'
                        }`}
                      >
                        {entry.sourceType === 'POS_SALE' ? 'Penjualan' : 'Manual'}
                      </Badge>
                    </div>
                    <span className="text-xs font-mono font-semibold text-gray-700">
                      {formatCurrency(Number(entry.amount))}
                    </span>
                  </div>

                  {/* Deskripsi */}
                  <p className="text-xs text-gray-600 leading-relaxed">{entry.description}</p>

                  {/* Debit */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-gray-400 w-10">{entry.debit.code}</span>
                      <span className="text-sm text-gray-800">{entry.debit.name}</span>
                      <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-1 rounded">D</span>
                    </div>
                    <span className="font-mono text-sm text-blue-700 font-medium">
                      {formatCurrency(Number(entry.amount))}
                    </span>
                  </div>

                  {/* Kredit — indented */}
                  <div className="flex items-center justify-between pl-5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-gray-400 w-10">{entry.credit.code}</span>
                      <span className="text-sm text-gray-500 italic">{entry.credit.name}</span>
                      <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1 rounded">K</span>
                    </div>
                    <span className="font-mono text-sm text-rose-600 font-medium">
                      {formatCurrency(Number(entry.amount))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6 text-sm">
              {page > 1 && (
                <a
                  href={`?page=${page - 1}${p.dateFrom ? `&dateFrom=${p.dateFrom}` : ''}${p.dateTo ? `&dateTo=${p.dateTo}` : ''}`}
                  className="px-3 py-1.5 rounded-lg border text-xs hover:bg-gray-50 transition-colors"
                >
                  ← Sebelumnya
                </a>
              )}
              <span className="text-xs text-muted-foreground px-2">
                Hal {page} dari {totalPages}
              </span>
              {page < totalPages && (
                <a
                  href={`?page=${page + 1}${p.dateFrom ? `&dateFrom=${p.dateFrom}` : ''}${p.dateTo ? `&dateTo=${p.dateTo}` : ''}`}
                  className="px-3 py-1.5 rounded-lg border text-xs hover:bg-gray-50 transition-colors"
                >
                  Berikutnya →
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer balance info */}
      {entries.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Total nilai jurnal pada periode ini:{' '}
          <span className="font-mono font-medium">{formatCurrency(totalAmount)}</span>
          {' '}· Debit = Kredit ✅
        </p>
      )}
    </div>
  );
}
