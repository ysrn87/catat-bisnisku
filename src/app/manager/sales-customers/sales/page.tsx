import { auth } from '@/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NewSaleDialog } from '@/components/sales/new-sale-dialog';
import { SalesTable } from '@/components/sales/sales-table';
import { getPointsConversionRate } from '@/actions/settings';
import { SearchFilterBar } from '@/components/filters/search-filter-bar';

async function getSales(params: {
  page?: number;
  limit?: number;
  search?: string;
  payment?: string;
  paymentStatus?: string;
  sort?: string;
}) {
  const {
    page = 1,
    limit = 10,
    search = '',
    payment = 'all',
    paymentStatus = 'all',
    sort = 'date_desc',
  } = params;

  const skip = (page - 1) * limit;
  const where: any = {};

  if (search) {
    where.OR = [
      { customer: { name: { contains: search, mode: 'insensitive' as const } } },
      { nonMemberCustomer: { name: { contains: search, mode: 'insensitive' as const } } },
      { saleNumber: { contains: search, mode: 'insensitive' as const } },
      { cashier: { name: { contains: search, mode: 'insensitive' as const } } },
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
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        customer: { select: { name: true, email: true, phone: true, address: true } },
        nonMemberCustomer: { select: { name: true, phone: true, address: true } },
        cashier: { select: { name: true } },
        items: {
          include: {
            variant: { include: { product: true } },
          },
        },
      },
    }),
    db.sale.count({ where }),
  ]);

  return {
    sales: sales.map((sale: typeof sales[number]) => {
      const { subtotal, discount, tax, total, items, ...saleRest } = sale;
      const ongkir = (saleRest as any).ongkir;
      delete (saleRest as any).ongkir;
      return {
        ...saleRest,
        subtotal: Number(subtotal),
        discount: Number(discount),
        tax: Number(tax),
        ongkir: Number(ongkir),
        total: Number(total),
        items: items.map((item: typeof items[number]) => {
          const { price, subtotal: itemSubtotal, variant, ...itemRest } = item;
          const { price: variantPrice, cost: variantCost, ...variantRest } = variant;
          return {
            ...itemRest,
            price: Number(price),
            subtotal: Number(itemSubtotal),
            variant: { ...variantRest, price: Number(variantPrice), cost: Number(variantCost) },
          };
        }),
      };
    }),
    total,
  };
}

async function getVariants() {
  const variants = await db.productVariant.findMany({
    where: {
      isActive: true,
      product: { isActive: true },
      OR: [{ stock: { gt: 0 } }, { product: { type: 'PREORDER' } }],
    },
    include: { product: true },
    orderBy: { product: { name: 'asc' } },
  });

  return variants.map((v: typeof variants[number]) => ({
    id: v.id,
    name: v.name,
    price: Number(v.price),
    stock: v.stock,
    points: v.points,
    barcode: v.barcode ?? null,
    product: { name: v.product.name, type: v.product.type },
  }));
}

async function getCustomers() {
  return db.user.findMany({
    where: { role: 'MEMBER' },
    select: { id: true, name: true, points: true },
    orderBy: { name: 'asc' },
  });
}

async function getNonMemberCustomers() {
  const customers = await db.customer.findMany({
    select: { id: true, name: true, phone: true, address: true },
    orderBy: { name: 'asc' },
  });
  return customers.map((c) => ({ ...c, address: c.address ?? '' }));
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    payment?: string;
    paymentStatus?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const page          = Number(params.page)  || 1;
  const limit         = Number(params.limit) || 10;
  const search        = params.search        || '';
  const payment       = params.payment       || 'all';
  const paymentStatus = params.paymentStatus || 'all';
  const sort          = params.sort          || 'date_desc';

  const [{ sales, total }, variants, customers, nonMemberCustomers, conversionRate, session] =
    await Promise.all([
      getSales({ page, limit, search, payment, paymentStatus, sort }),
      getVariants(),
      getCustomers(),
      getNonMemberCustomers(),
      getPointsConversionRate(),
      auth(),
    ]);

  const userRole = session?.user?.role ?? 'MANAGER';

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex justify-between items-center">
        <div className="hidden sm:block">
          <NewSaleDialog
            variants={variants}
            customers={customers}
            nonMemberCustomers={nonMemberCustomers}
            conversionRate={conversionRate}
          />
        </div>
      </div>

      {/* Mobile FAB */}
      <div className="sm:hidden fixed bottom-24 right-6 z-50">
        <NewSaleDialog
          variants={variants}
          customers={customers}
          nonMemberCustomers={nonMemberCustomers}
          conversionRate={conversionRate}
          trigger={
            <button className="w-12 h-12 rounded-full bg-[#028697] text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm sm:text-xl">Penjualan Terbaru</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SearchFilterBar
            searchPlaceholder="Cari customer, nomor penjualan, atau kasir..."
            filters={[
              {
                key: 'payment',
                label: 'Metode Pembayaran',
                defaultValue: 'all',
                options: [
                  { value: 'all',      label: 'Semua Metode' },
                  { value: 'CASH',     label: 'Cash' },
                  { value: 'CARD',     label: 'Card' },
                  { value: 'TRANSFER', label: 'Transfer Bank' },
                ],
              },
              {
                key: 'paymentStatus',
                label: 'Status Pembayaran',
                defaultValue: 'all',
                options: [
                  { value: 'all',     label: 'Semua Status' },
                  { value: 'PAID',    label: 'Lunas' },
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'UNPAID',  label: 'Belum Lunas' },
                ],
              },
            ]}
            sortOptions={[
              { value: 'date_desc',  label: 'Terbaru' },
              { value: 'date_asc',   label: 'Terlama' },
              { value: 'total_desc', label: 'Jumlah Terbesar' },
              { value: 'total_asc',  label: 'Jumlah Terkecil' },
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
