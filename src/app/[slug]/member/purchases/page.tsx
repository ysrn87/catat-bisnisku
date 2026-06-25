import { auth } from '@/auth';
import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { ShoppingBag } from 'lucide-react';
import { PurchaseHistoryTable } from '@/components/member/purchase-history-table';

async function getPurchases(userId: string, storeId: string, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  const [purchases, total] = await Promise.all([
    db.sale.findMany({
      where: { customerId: userId, storeId },
      skip, take: limit, orderBy: { createdAt: 'desc' },
      include: {
        items:   { include: { variant: { include: { product: true } } } },
        payment: { select: { method: true, status: true } }, // FIX: dari Payment model
      },
    }),
    db.sale.count({ where: { customerId: userId, storeId } }),
  ]);

  return {
    purchases: purchases.map((p) => ({
      ...p,
      subtotal: Number(p.subtotal), discount: Number(p.discount),
      tax:      Number(p.tax),      ongkir:   Number(p.ongkir),
      total:    Number(p.total),
      items: p.items.map((item) => ({
        ...item, price: Number(item.price), subtotal: Number(item.subtotal),
        variant: { ...item.variant, price: Number(item.variant.price), cost: Number(item.variant.cost) },
      })),
    })),
    total,
  };
}

export default async function PurchasesPage({ searchParams }: {
  searchParams: Promise<{ page?: string; limit?: string }>;
}) {
  const session = await auth();
  if (!session) return null;

  const { storeId } = await getStoreContext();
  const p     = await searchParams;
  const page  = Number(p.page)  || 1;
  const limit = Number(p.limit) || 10;

  const { purchases, total } = await getPurchases(session.user.id, storeId, page, limit);

  const totalSpent = purchases.reduce((sum, p) => sum + p.total, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingBag className="w-6 h-6" /> Riwayat Pembelian
        </h1>
        <p className="text-gray-600 mt-1">Total {total} transaksi · Total belanja {formatCurrency(totalSpent)}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Daftar Transaksi</CardTitle></CardHeader>
        <CardContent>
          <PurchaseHistoryTable
            purchases={purchases}
            currentPage={page}
            pageSize={limit}
            totalItems={total}
          />
        </CardContent>
      </Card>
    </div>
  );
}
