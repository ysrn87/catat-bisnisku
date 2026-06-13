import { auth } from '@/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CustomersTable } from '@/components/customers/customers-table';
import { AddCustomerMenu } from '@/components/customers/add-customer-menu';
import { CustomerDialog } from '@/components/customers/customer-dialog';
import { NonMemberDialog } from '@/components/customers/non-member-dialog';
import { SearchFilterBar } from '@/components/filters/search-filter-bar';

async function getCustomers(params: {
  page?: number;
  limit?: number;
  search?: string;
  points?: string;
  sort?: string;
}) {
  const {
    page = 1,
    limit = 10,
    search = '',
    points = 'all',
    sort = 'name_asc',
  } = params;

  const skip = (page - 1) * limit;

  const memberWhere: any = { role: 'MEMBER' };

  if (search) {
    memberWhere.OR = [
      { name: { contains: search, mode: 'insensitive' as const } },
      { phone: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  if (points !== 'all') {
    switch (points) {
      case 'low':    memberWhere.points = { lt: 100 }; break;
      case 'medium': memberWhere.points = { gte: 100, lt: 500 }; break;
      case 'high':   memberWhere.points = { gte: 500 }; break;
    }
  }

  const nonMemberWhere: any = {};
  if (search) {
    nonMemberWhere.OR = [
      { name: { contains: search, mode: 'insensitive' as const } },
      { phone: { contains: search, mode: 'insensitive' as const } },
      { address: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  const [members, nonMembers] = await Promise.all([
    db.user.findMany({
      where: memberWhere,
      include: {
        sales: { select: { id: true, total: true } },
        _count: { select: { sales: true } },
      },
    }),
    db.customer.findMany({
      where: nonMemberWhere,
      include: {
        sales: { select: { id: true, total: true } },
        _count: { select: { sales: true } },
      },
    }),
  ]);

  const serializedMembers = members.map((c) => ({
    ...c,
    type: 'member' as const,
    sales: c.sales.map((s) => ({ id: s.id, total: Number(s.total) })),
  }));

  const serializedNonMembers = nonMembers.map((c) => ({
    ...c,
    address: c.address ?? '',
    type: 'non-member' as const,
    sales: c.sales.map((s) => ({ id: s.id, total: Number(s.total) })),
  }));

  let allCustomers = [...serializedMembers, ...serializedNonMembers];

  switch (sort) {
    case 'name_asc':    allCustomers.sort((a, b) => a.name.localeCompare(b.name)); break;
    case 'name_desc':   allCustomers.sort((a, b) => b.name.localeCompare(a.name)); break;
    case 'points_asc':  allCustomers.sort((a, b) => (a.type === 'member' ? a.points : 0) - (b.type === 'member' ? b.points : 0)); break;
    case 'points_desc': allCustomers.sort((a, b) => (b.type === 'member' ? b.points : 0) - (a.type === 'member' ? a.points : 0)); break;
    case 'joined_asc':  allCustomers.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break;
    case 'joined_desc': allCustomers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
    default:            allCustomers.sort((a, b) => a.name.localeCompare(b.name));
  }

  const total = allCustomers.length;
  const paginatedCustomers = allCustomers.slice(skip, skip + limit);

  return { customers: paginatedCustomers, total };
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    points?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const page   = Number(params.page)  || 1;
  const limit  = Number(params.limit) || 10;
  const search = params.search || '';
  const points = params.points || 'all';
  const sort   = params.sort   || 'name_asc';

  const [{ customers, total }, session] = await Promise.all([
    getCustomers({ page, limit, search, points, sort }),
    auth(),
  ]);

  const isAdmin = session?.user?.role === 'ADMINISTRATOR';

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Desktop buttons */}
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

      {/* Mobile FAB */}
      <div className="sm:hidden fixed bottom-24 right-6 z-50">
        {isAdmin ? (
          <AddCustomerMenu
            trigger={
              <button className="w-12 h-12 rounded-full bg-[#028697] text-white shadow-lg flex items-center justify-center hover:bg-[#028697]/90 active:scale-95 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            }
          />
        ) : (
          <NonMemberDialog
            mode="create"
            trigger={
              <button className="w-12 h-12 rounded-full bg-[#028697] text-white shadow-lg flex items-center justify-center hover:bg-[#028697]/90 active:scale-95 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            }
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm md:text-xl">Daftar Pelanggan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchFilterBar
            searchPlaceholder="Cari berdasarkan nama, telepon, atau email..."
            filters={[
              {
                key: 'points',
                label: 'Rentang Poin',
                defaultValue: 'all',
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
