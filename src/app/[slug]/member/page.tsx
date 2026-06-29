import { auth } from '@/auth';
import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Award, ShoppingBag } from 'lucide-react';
import { MemberCard } from '@/components/member/member-card';
import { PointsHistoryTable } from '@/components/customers/points-history-table';

async function getMemberData(userId: string, storeId: string, page = 1, limit = 10) {
  const skip      = (page - 1) * limit;
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  const storeUser = await db.storeUser.findUnique({
    where:  { storeId_userId: { storeId, userId } },
    select: { id: true, points: true },
  });

  const [user, pointsHistory, pointsTotal, todayPurchases, yesterdayPurchases] = await Promise.all([
    db.user.findUnique({
      where:  { id: userId },
      // FIX: User tidak punya address — dihapus dari schema
      select: { id: true, name: true, email: true, phone: true, birthday: true, photoUrl: true, createdAt: true },
    }),
    db.pointHistory.findMany({
      where:   { storeUserId: storeUser?.id ?? '' },
      skip, take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    db.pointHistory.count({ where: { storeUserId: storeUser?.id ?? '' } }),
    db.sale.findMany({
      where:   { memberId: storeUser?.id, storeId, createdAt: { gte: today } },
      include: { items: { include: { variant: { include: { product: true } } } } },
    }),
    db.sale.findMany({
      where:   { memberId: storeUser?.id, storeId, createdAt: { gte: yesterday, lt: today } },
      include: { items: true },
    }),
  ]);

  if (!user) throw new Error('Member tidak ditemukan');

  return {
    user:              { ...user, points: storeUser?.points ?? 0 },
    pointsHistory,
    pointsTotal,
    todayPurchases,
    yesterdayPurchases,
  };
}

export default async function MemberDashboard({ searchParams }: {
  searchParams: Promise<{ page?: string; limit?: string }>;
}) {
  const session = await auth();
  if (!session) return null;

  const { storeId } = await getStoreContext();
  const params = await searchParams;
  const page   = Number(params.page)  || 1;
  const limit  = Number(params.limit) || 10;

  const { user, pointsHistory, pointsTotal, todayPurchases } =
    await getMemberData(session.user.id as string, storeId, page, limit);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-medium">Selamat datang,</h1>
        <h1 className="text-3xl font-bold">{user?.name}</h1>
        <p className="text-gray-600">Lihat profil dan poin keanggotaan</p>
      </div>

      {user && (
        <MemberCard
          user={{
            id:        user.id,
            name:      user.name,
            email:     user.email,
            phone:     user.phone ?? undefined,   // FIX: phone optional di MemberCard
            birthday:  user.birthday,
            photoUrl:  user.photoUrl,
            points:    user.points,
            createdAt: user.createdAt,
          }}
          showMembershipId={true}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-semibold text-xl">
            <ShoppingBag className="w-5 h-5 text-[#028697]" />
            Pembelian Hari Ini
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayPurchases.length === 0 ? (
            <p className="text-gray-500 text-sm">Belum ada pembelian hari ini.</p>
          ) : (
            <div className="space-y-3">
              {todayPurchases.map((sale) => (
                <div key={sale.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">#{sale.saleNumber}</p>
                    <p className="text-xs text-gray-500">{sale.items.length} item</p>
                  </div>
                  <p className="font-semibold text-sm text-[#028697]">
                    {formatCurrency(Number(sale.total))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-semibold text-xl">
            <Award className="w-5 h-5 text-[#028697]" />
            Riwayat Poin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PointsHistoryTable
            pointsHistory={pointsHistory}
            totalItems={pointsTotal}
            currentPage={page}
            pageSize={limit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
