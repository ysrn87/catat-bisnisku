import { auth } from '@/auth';
import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { getPointsConversionRate } from '@/actions/settings';
import { PurchaseHistoryView } from '@/components/member/purchase-history-view';

async function getPurchaseHistory(userId: string, storeId: string) {
  return db.sale.findMany({
    where: { customerId: userId, storeId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: {
          variant: { include: { product: true } },
        },
      },
    },
  });
}

export default async function MemberPurchasesPage() {
  const session = await auth();
  if (!session) return null;

  const { storeId } = await getStoreContext();

  const [purchases, conversionRate] = await Promise.all([
    getPurchaseHistory(session.user.id, storeId),
    getPointsConversionRate(),
  ]);

  const serializedPurchases = purchases.map((purchase) => ({
    ...purchase,
    subtotal: Number(purchase.subtotal),
    discount: Number(purchase.discount),
    tax:      Number(purchase.tax),
    ongkir:   Number((purchase as any).ongkir ?? 0),
    total:    Number(purchase.total),
    items: purchase.items.map((item) => ({
      ...item,
      price:    Number(item.price),
      subtotal: Number(item.subtotal),
      variant: {
        ...item.variant,
        price: Number(item.variant.price),
        cost:  Number(item.variant.cost),
      },
    })),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Riwayat Pembelian</h1>
        <p className="text-gray-600">Lihat semua pembelian terdahulu</p>
      </div>
      <PurchaseHistoryView
        purchases={serializedPurchases}
        conversionRate={conversionRate}
      />
    </div>
  );
}
