import { auth } from '@/auth';
import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CustomersTable } from '@/components/customers/customers-table';
import { SearchFilterBar } from '@/components/filters/search-filter-bar';
import { CustomerActions } from '@/components/page-actions/customer-actions';

async function getCustomers(storeId: string, params: {
  page?: number; limit?: number; search?: string; points?: string; sort?: string;
}) {
  const { page = 1, limit = 10, search = '', points = 'all', sort = 'name_asc' } = params;
  const skip = (page - 1) * limit;

  // ── Members: user yang punya StoreUser MEMBER di store ini ──────────────────
  const memberWhere: any = { storeId, role: 'MEMBER' };
  const memberUserWhere: any = {};

  if (search) {
    memberUserWhere.OR = [
      { name:  { contains: search, mode: 'insensitive' as const } },
      { phone: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
    ];
  }
  if (points !== 'all') {
    switch (points) {
      case 'low':    memberUserWhere.points = { lt: 100 }; break;
      case 'medium': memberUserWhere.points = { gte: 100, lt: 500 }; break;
      case 'high':   memberUserWhere.points = { gte: 500 }; break;
    }
  }

  // ── Non-members: Customer table, scoped ke storeId ──────────────────────────
  const nonMemberWhere: any = { storeId };
  if (search) {
    nonMemberWhere.OR = [
      { name:    { contains: search, mode: 'insensitive' as const } },
      { phone:   { contains: search, mode: 'insensitive' as const } },
      { address: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  const [storeUsers, nonMembers] = await Promise.all([
    db.storeUser.findMany({
      where: Object.keys(memberUserWhere).length > 0
        ? { ...memberWhere, user: memberUserWhere }
        : memberWhere,
      include: {
        user: {
          include: {
            sales: { where: { storeId }, select: { id: true, total: true } },
            _count: { select: { sales: true } },
          },
        },
      },
    }),
    db.customer.findMany({
      where: nonMemberWhere,
      include: {
        sales: { where: { storeId }, select: { id: true, total: true } },
        _count: { select: { sales: true } },
      },
    }),
  ]);

  const members = storeUsers.map((su) => ({
    ...su.user,
    type: 'member' as const,
    sales: su.user.sales.map((s) => ({ id: s.id, total: Number(s.total) })),
  }));

  const nonMembersSerialized = nonMembers.map((c) => ({
    ...c,
    address: c.address ?? '',
    type: 'non-member' as const,
    sales: c.sales.map((s) => ({ id: s.id, total: Number(s.total) })),
  }));

  let allCustomers = [...members, ...nonMembersSerialized];

  switch (sort) {
    case 'name_asc':    allCustomers.sort((a, b) => a.name.localeCompare(b.name)); break;
    case 'name_desc':   allCustomers.sort((a, b) => b.name.localeCompare(a.name)); break;
    case 'points_desc': allCustomers.sort((a, b) => (b.type === 'member' ? (b as any).points : 0) - (a.type === 'member' ? (a as any).points : 0)); break;
    case 'points_asc':  allCustomers.sort((a, b) => (a.type === 'member' ? (a as any).points : 0) - (b.type === 'member' ? (b as any).points : 0)); break;
    case 'joined_desc': allCustomers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
    case 'joined_asc':  allCustomers.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break;
    default:            allCustomers.sort((a, b) => a.name.localeCompare(b.name));
  }

  return { customers: allCustomers.slice(skip, skip + limit), total: allCustomers.length };
}

export default async function CashierCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; search?: string; points?: string; sort?: string }>;
}) {
  const p = await searchParams;
  const page   = Number(p.page)  || 1;
  const limit  = Number(p.limit) || 10;
  const search = p.search || '';
  const points = p.points || 'all';
  const sort   = p.sort   || 'name_asc';

  const [{ storeId }, session] = await Promise.all([getStoreContext(), auth()]);
  const { customers, total } = await getCustomers(storeId, { page, limit, search, points, sort });

  // Pakai role per-store yang sebenarnya, bukan Role global session.user.role —
  // supaya OWNER/ADMINISTRATOR yang mengakses /cashier tetap dapat menu lengkap,
  // sementara CASHIER asli hanya dapat "Tambah Non-Member".
  const storeUser = await db.storeUser.findUnique({
    where: { storeId_userId: { storeId, userId: session!.user.id } },
    select: { role: true },
  });
  const isAdmin = storeUser?.role === 'OWNER' || storeUser?.role === 'ADMINISTRATOR';

  return (
    <div className="space-y-6 md:space-y-8">
      <CustomerActions isAdmin={isAdmin} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm md:text-xl">Daftar Pelanggan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchFilterBar
            searchPlaceholder="Cari berdasarkan nama, telepon, atau email..."
            filters={[
              {
                key: 'points', label: 'Rentang Poin', defaultValue: 'all',
                options: [
                  { value: 'all',    label: 'Semua Poin' },
                  { value: 'low',    label: '< 100 poin' },
                  { value: 'medium', label: '100–499 poin' },
                  { value: 'high',   label: '500+ poin' },
                ],
              },
            ]}
            sortOptions={[
              { value: 'name_asc',    label: 'Nama (A-Z)' },
              { value: 'name_desc',   label: 'Nama (Z-A)' },
              { value: 'points_desc', label: 'Poin Terbanyak' },
              { value: 'points_asc',  label: 'Poin Tersedikit' },
              { value: 'joined_desc', label: 'Terbaru Bergabung' },
              { value: 'joined_asc',  label: 'Terlama Bergabung' },
            ]}
            defaultSort="name_asc"
          />
          <CustomersTable
            customers={customers}
            showActions={true}
            currentPage={page}
            pageSize={limit}
            totalItems={total}
          />
        </CardContent>
      </Card>
    </div>
  );
}
