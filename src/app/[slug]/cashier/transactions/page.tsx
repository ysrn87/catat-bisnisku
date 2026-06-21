import { auth } from '@/auth';
import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NewSaleDialog } from '@/components/sales/new-sale-dialog';
import { SalesTable } from '@/components/sales/sales-table';
import { getPointsConversionRate } from '@/actions/settings';
import { SearchFilterBar } from '@/components/filters/search-filter-bar';
import { SalesActions } from '@/components/page-actions/sales-actions';

async function getSales(storeId: string, cashierId: string, params: {
  page?: number; limit?: number; search?: string;
  payment?: string; paymentStatus?: string; sort?: string;
}) {
  const { page = 1, limit = 10, search = '', payment = 'all', paymentStatus = 'all', sort = 'date_desc' } = params;
  const skip = (page - 1) * limit;
  // Hanya transaksi yang dibuat oleh kasir ini sendiri
  const where: any = { storeId, cashierId };

  if (search) {
    where.OR = [
      { customer: { name: { contains: search, mode: 'insensitive' as const } } },
      { nonMemberCustomer: { name: { contains: search, mode: 'insensitive' as const } } },
      { saleNumber: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  if (payment !== 'all') where.paymentMethod = payment;
  if (paymentStatus !== 'all') where.paymentStatus = paymentStatus;

  const orderBy: any = [];
  switch (sort) {
    case 'date_asc':   orderBy.push({ createdAt: 'asc' }); break;
    case 'total_asc':  orderBy.push({ total: 'asc' }); break;
    case 'total_desc': orderBy.push({ total: 'desc' }); break;
    default:           orderBy.push({ createdAt: 'desc' });
  }

  const [sales, total] = await Promise.all([
    db.sale.findMany({
      where, skip, take: limit, orderBy,
      include: {
        customer: { select: { name: true, email: true, phone: true, address: true } },
        nonMemberCustomer: { select: { name: true, phone: true, address: true } },
        cashier: { select: { name: true } },
        items: { include: { variant: { include: { product: true } } } },
      },
    }),
    db.sale.count({ where }),
  ]);

  return {
    sales: sales.map((sale: typeof sales[number]) => {
      const { subtotal, discount, tax, total, items, ...rest } = sale;
      const ongkir = (rest as any).ongkir; delete (rest as any).ongkir;
      return {
        ...rest,
        subtotal: Number(subtotal), discount: Number(discount),
        tax: Number(tax), ongkir: Number(ongkir), total: Number(total),
        items: items.map((item: typeof items[number]) => {
          const { price, subtotal: s, variant, ...ir } = item;
          const { price: vp, cost: vc, ...vr } = variant;
          return { ...ir, price: Number(price), subtotal: Number(s), variant: { ...vr, price: Number(vp), cost: Number(vc) } };
        }),
      };
    }),
    total,
  };
}

async function getVariants(storeId: string) {
  const variants = await db.productVariant.findMany({
    where: {
      storeId,
      isActive: true,
      product: { isActive: true },
      OR: [{ stock: { gt: 0 } }, { type: 'PREORDER' }],
    },
    include: { product: { select: { name: true } } },
    orderBy: { product: { name: 'asc' } },
  });
  return variants.map((v: typeof variants[number]) => ({
    id: v.id, name: v.name, price: Number(v.price),
    stock: v.stock, points: v.points, barcode: v.barcode ?? null,
    type: v.type,
    product: { name: v.product.name },
  }));
}

async function getMembers(storeId: string) {
  const storeUsers = await db.storeUser.findMany({
    where: { storeId, role: 'MEMBER' },
    include: { user: { select: { id: true, name: true, points: true } } },
  });
  return storeUsers.map((su) => su.user);
}

async function getNonMembers(storeId: string) {
  const customers = await db.customer.findMany({
    where: { storeId },
    select: { id: true, name: true, phone: true, address: true },
    orderBy: { name: 'asc' },
  });
  return customers.map((c) => ({ ...c, address: c.address ?? '' }));
}

export default async function CashierTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string; limit?: string; search?: string;
    payment?: string; paymentStatus?: string; sort?: string;
  }>;
}) {
  const p = await searchParams;
  const page          = Number(p.page)  || 1;
  const limit         = Number(p.limit) || 10;
  const search        = p.search        || '';
  const payment       = p.payment       || 'all';
  const paymentStatus = p.paymentStatus || 'all';
  const sort          = p.sort          || 'date_desc';

  const [{ storeId }, session] = await Promise.all([getStoreContext(), auth()]);
  const cashierId = session!.user.id;

  const [{ sales, total }, variants, members, nonMembers, conversionRate] = await Promise.all([
    getSales(storeId, cashierId, { page, limit, search, payment, paymentStatus, sort }),
    getVariants(storeId),
    getMembers(storeId),
    getNonMembers(storeId),
    getPointsConversionRate(),
  ]);

  const storeUser = await db.storeUser.findUnique({
    where: { storeId_userId: { storeId, userId: cashierId } },
    select: { role: true },
  });
  const userRole = storeUser?.role ?? 'CASHIER';

  return (
    <div className="space-y-6 md:space-y-8">
      <SalesActions
        variants={variants}
        customers={members}
        nonMemberCustomers={nonMembers}
        conversionRate={conversionRate}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm sm:text-xl">Transaksi Saya</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SearchFilterBar
            searchPlaceholder="Cari customer atau nomor penjualan..."
            filters={[
              {
                key: 'payment', label: 'Metode Pembayaran', defaultValue: 'all',
                options: [
                  { value: 'all', label: 'Semua Metode' }, { value: 'CASH', label: 'Cash' },
                  { value: 'CARD', label: 'Card' }, { value: 'TRANSFER', label: 'Transfer Bank' },
                ],
              },
              {
                key: 'paymentStatus', label: 'Status Pembayaran', defaultValue: 'all',
                options: [
                  { value: 'all', label: 'Semua Status' }, { value: 'PAID', label: 'Lunas' },
                  { value: 'PENDING', label: 'Pending' }, { value: 'UNPAID', label: 'Belum Lunas' },
                ],
              },
            ]}
            sortOptions={[
              { value: 'date_desc', label: 'Terbaru' }, { value: 'date_asc', label: 'Terlama' },
              { value: 'total_desc', label: 'Jumlah Terbesar' }, { value: 'total_asc', label: 'Jumlah Terkecil' },
            ]}
            defaultSort="date_desc"
          />
          <SalesTable
            sales={sales}
            currentPage={page}
            pageSize={limit}
            totalItems={total}
            conversionRate={conversionRate}
            userRole={userRole}
            variants={variants}
          />
        </CardContent>
      </Card>
    </div>
  );
}
