import { auth } from '@/auth';
import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CustomerActions } from '@/components/page-actions/customer-actions';
import { CustomersTable } from '@/components/customers/customers-table';
import { SearchFilterBar } from '@/components/filters/search-filter-bar';

async function getCustomersData(storeId: string, params: { page?: number; limit?: number; search?: string; sort?: string; role?: string }) {
  const { page = 1, limit = 10, search = '', sort = 'name_asc', role = 'all' } = params;
  const skip = (page - 1) * limit;

  const where: any = { storeId };
  if (role !== 'all') where.role = role;

  if (search) {
    where.user = {
      OR: [
        { name:  { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        // FIX: hapus { address: ... } — tidak di-search by address
        // address tetap ada di User (sudah ditambah balik), tapi search lebih relevan by name/phone/email
      ],
    };
  }

  const orderBy: any = [];
  switch (sort) {
    case 'name_desc':   orderBy.push({ user: { name: 'desc' } }); break;
    case 'points_asc':  orderBy.push({ points: 'asc' }); break;
    case 'points_desc': orderBy.push({ points: 'desc' }); break;
    case 'newest':      orderBy.push({ joinedAt: 'desc' }); break;  // FIX: createdAt → joinedAt
    default:            orderBy.push({ user: { name: 'asc' } });
  }

  const [storeUsers, total] = await Promise.all([
    db.storeUser.findMany({
      where, skip, take: limit, orderBy,
      include: {
        user: {
          select: {
            id: true, name: true, email: true, phone: true, address: true,
            birthday: true, photoUrl: true, createdAt: true,
            customerSales: {
              where: { storeId },
              select: { id: true, total: true },
            },
            _count: { select: { customerSales: { where: { storeId } } } },
          },
        },
      },
    }),
    db.storeUser.count({ where }),
  ]);

  return {
    customers: storeUsers.map((su) => ({
      id:        su.user.id,
      name:      su.user.name,
      email:     su.user.email,
      phone:     su.user.phone,
      address:   su.user.address ?? null,
      birthday:  su.user.birthday,
      photoUrl:  su.user.photoUrl,
      createdAt: su.user.createdAt,
      points:    su.points,
      sales:     su.user.customerSales.map((s) => ({ id: s.id, total: Number(s.total) })),
      _count:    { sales: su.user._count.customerSales },
      type:      (su.role === 'MEMBER' ? 'member' : 'non-member') as 'member' | 'non-member',
    })),
    total,
  };
}

export default async function CustomersPage({ searchParams }: {
  searchParams: Promise<{ page?: string; limit?: string; search?: string; sort?: string; role?: string }>;
}) {
  const p = await searchParams;
  const [{ storeId }, session] = await Promise.all([getStoreContext(), auth()]);

  const { customers, total } = await getCustomersData(storeId, { page: Number(p.page) || 1, limit: Number(p.limit) || 10, search: p.search, sort: p.sort, role: p.role });

  // FIX: isAdmin dari StoreUser, bukan session.user.role
  const storeUser = await db.storeUser.findUnique({
    where:  { storeId_userId: { storeId, userId: session!.user.id } },
    select: { role: true },
  });
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
              { key: 'role', label: 'Tipe Pelanggan', defaultValue: 'all', options: [
                { value: 'all',      label: 'Semua' },
                { value: 'MEMBER',   label: 'Member' },
                { value: 'CUSTOMER', label: 'Customer' },
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
            currentPage={Number(p.page) || 1}
            pageSize={Number(p.limit) || 10}
            totalItems={total}
          />
        </CardContent>
      </Card>
    </div>
  );
}
