import { auth } from '@/auth';
import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CustomerActions } from '@/components/page-actions/customer-actions';
import { CustomersTable } from '@/components/customers/customers-table';
import { SearchFilterBar } from '@/components/filters/search-filter-bar';

async function getCustomersData(storeId: string, params: {
  page?: number; limit?: number; search?: string; sort?: string; type?: string;
}) {
  const { page = 1, limit = 10, search = '', sort = 'name_asc', type = 'all' } = params;
  const skip = (page - 1) * limit;

  // ── Members (StoreUser with role MEMBER) ──────────────────────────────────
  const memberWhere: any = { storeId };
  if (search) {
    memberWhere.user = {
      OR: [
        { name:  { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  // ── Walk-in Customers (Customer table) ────────────────────────────────────
  const customerWhere: any = { storeId };
  if (search) {
    customerWhere.OR = [
      { name:  { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  const orderByMember: any[]   = [];
  const orderByCustomer: any[] = [];
  switch (sort) {
    case 'name_desc':   orderByMember.push({ user: { name: 'desc' } }); orderByCustomer.push({ name: 'desc' }); break;
    case 'points_asc':  orderByMember.push({ points: 'asc' });           orderByCustomer.push({ createdAt: 'asc' }); break;
    case 'points_desc': orderByMember.push({ points: 'desc' });          orderByCustomer.push({ createdAt: 'desc' }); break;
    case 'newest':      orderByMember.push({ joinedAt: 'desc' });        orderByCustomer.push({ createdAt: 'desc' }); break;
    default:            orderByMember.push({ user: { name: 'asc' } });   orderByCustomer.push({ name: 'asc' });
  }

  const [members, memberTotal, walkIns, walkInTotal] = await Promise.all([
    type === 'customer' ? [] : db.storeUser.findMany({
      where: memberWhere, skip, take: limit, orderBy: orderByMember,
      include: {
        user: {
          select: {
            id: true, name: true, email: true, phone: true,
            birthday: true, photoUrl: true, createdAt: true,
          },
        },
        memberSales: {
          where:  { storeId },
          select: { id: true, total: true },
        },
      },
    }),
    type === 'customer' ? 0 : db.storeUser.count({ where: memberWhere }),

    type === 'member' ? [] : db.customer.findMany({
      where: customerWhere, skip, take: limit, orderBy: orderByCustomer,
      include: {
        sales: { where: { storeId }, select: { id: true, total: true } },
        user:  { select: { id: true } },
      },
    }),
    type === 'member' ? 0 : db.customer.count({ where: customerWhere }),
  ]);

  const memberRows = (members as any[]).map((su) => ({
    id:        su.id,          // StoreUser.id (dipakai untuk points history & purchase history)
    userId:    su.user.id,
    name:      su.user.name,
    email:     su.user.email,
    phone:     su.user.phone,
    address:   su.user.address ?? null,
    birthday:  su.user.birthday,
    photoUrl:  su.user.photoUrl,
    createdAt: su.joinedAt,
    points:    su.points,
    sales:     su.memberSales.map((s: any) => ({ id: s.id, total: Number(s.total) })),
    _count:    { sales: su.memberSales.length },
    type:      'member' as const,
  }));

  const customerRows = (walkIns as any[]).map((c) => ({
    id:        c.id,           // Customer.id
    name:      c.name,
    phone:     c.phone ?? '',
    address:   c.address,
    createdAt: c.createdAt,
    sales:     c.sales.map((s: any) => ({ id: s.id, total: Number(s.total) })),
    _count:    { sales: c.sales.length },
    type:      'non-member' as const,
    hasAccount: !!c.userId,    // sudah punya akun tapi belum diupgrade
  }));

  return {
    customers: [...memberRows, ...customerRows],
    total:     memberTotal + walkInTotal,
  };
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; search?: string; sort?: string; type?: string }>;
}) {
  const p = await searchParams;
  const [{ storeId }, session] = await Promise.all([getStoreContext(), auth()]);

  const { customers, total } = await getCustomersData(storeId, {
    page:  Number(p.page) || 1,
    limit: Number(p.limit) || 10,
    search: p.search,
    sort:   p.sort,
    type:   p.type,
  });

  const storeUser = await db.storeStaff.findUnique({ where: { storeId_userId: { storeId, userId: session!.user.id } }, select: { role: true } });
  const isAdmin = storeUser?.role === 'OWNER' || storeUser?.role === 'ADMINISTRATOR';

  return (
    <div className="space-y-6 md:space-y-8">
      <CustomerActions isAdmin={isAdmin} />

      <Card>
        <CardHeader><CardTitle className="text-sm sm:text-xl">Daftar Pelanggan</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <SearchFilterBar
            searchPlaceholder="Cari nama, telepon, atau email..."
            filters={[
              { key: 'type', label: 'Tipe Pelanggan', defaultValue: 'all', options: [
                { value: 'all',      label: 'Semua' },
                { value: 'member',   label: 'Member' },
                { value: 'customer', label: 'Customer' },
              ]},
            ]}
            sortOptions={[
              { value: 'name_asc',    label: 'Nama A-Z' },
              { value: 'name_desc',   label: 'Nama Z-A' },
              { value: 'points_desc', label: 'Poin Terbanyak' },
              { value: 'points_asc',  label: 'Poin Tersedikit' },
              { value: 'newest',      label: 'Bergabung Terbaru' },
            ]}
            defaultSort="name_asc"
          />
          <CustomersTable
            customers={customers}
            showActions={isAdmin}
            currentPage={Number(p.page) || 1}
            pageSize={Number(p.limit) || 10}
            totalItems={total}
          />
        </CardContent>
      </Card>
    </div>
  );
}
