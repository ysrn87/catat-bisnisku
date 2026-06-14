import { auth } from '@/auth';
import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CustomersTable } from '@/components/customers/customers-table';
import { AddCustomerMenu } from '@/components/customers/add-customer-menu';
import { CustomerDialog } from '@/components/customers/customer-dialog';
import { NonMemberDialog } from '@/components/customers/non-member-dialog';
import { SearchFilterBar } from '@/components/filters/search-filter-bar';
import { MobileFab } from '@/components/ui/mobile-fab';

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

export default async function CustomersPage({
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
  const isAdmin = session?.user?.role === 'ADMINISTRATOR';

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="hidden sm:block">
        {isAdmin ? (
          <AddCustomerMenu />
        ) : (
          <div className="flex gap-2">
            <NonMemberDialog mode="create" />
            <CustomerDialog mode="create" />
          </div>
        )}
      </div>
      <MobileFab>
        {isAdmin ? (
          <AddCustomerMenu
            trigger={
              <button className="w-12 h-12 rounded-full bg-[#028697] text-white shadow-lg flex items-center justify-center hover:bg-[#028697]/90 active:scale-95 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            }
          />
        ) : (
          <NonMemberDialog
            mode="create"
            trigger={
              <button className="w-12 h-12 rounded-full bg-[#028697] text-white shadow-lg flex items-center justify-center hover:bg-[#028697]/90 active:scale-95 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            }
          />
        )}
      </MobileFab>

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
