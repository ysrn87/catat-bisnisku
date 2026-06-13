import { auth } from '@/auth';
import { db } from '@/lib/db';
import { getPointsConversionRate } from '@/actions/settings';
import { PurchaseHistoryView } from '@/components/member/purchase-history-view';

async function getPurchaseHistory(userId: string) {
  return db.sale.findMany({
    where: { customerId: userId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: true,
            },
          },
        },
      },
    },
  });
}

export default async function MemberPurchasesPage() {
  const session = await auth();
  if (!session) return null;

  const [purchases, conversionRate] = await Promise.all([
    getPurchaseHistory(session.user.id),
    getPointsConversionRate(),
  ]);

  // Serialize Decimal fields to numbers for client component
  const serializedPurchases = purchases.map((purchase: typeof purchases[number]) => ({
    ...purchase,
    subtotal: Number(purchase.subtotal),
    discount: Number(purchase.discount),
    tax: Number(purchase.tax),
    total: Number(purchase.total),
    items: purchase.items.map((item: typeof purchase.items[number]) => ({
      ...item,
      price: Number(item.price),
      subtotal: Number(item.subtotal),
      variant: {
        ...item.variant,
        price: Number(item.variant.price),
        cost: Number(item.variant.cost),
      }
    }))
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