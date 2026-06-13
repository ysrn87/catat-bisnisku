import { auth } from '@/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Award, ShoppingBag, ArrowUp, ArrowDown } from 'lucide-react';
import { MemberCard } from '@/components/member/member-card';
import { PointsHistoryTable } from '@/components/customers/points-history-table';

async function getMemberData(userId: string, page: number = 1, limit: number = 10) {
  const skip = (page - 1) * limit;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [user, pointsHistory, pointsTotal, todayPurchases, yesterdayPurchases] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        points: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        birthday: true,
        photoUrl: true,
        createdAt: true,
      },
    }),
    db.pointHistory.findMany({
      where: { userId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    db.pointHistory.count({
      where: { userId },
    }),
    db.sale.findMany({
      where: {
        customerId: userId,
        createdAt: { gte: today }
      },
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
    }),
    db.sale.findMany({
      where: {
        customerId: userId,
        createdAt: {
          gte: yesterday,
          lt: today
        }
      },
      include: {
        items: true,
      },
    }),
  ]);

  return { user, pointsHistory, pointsTotal, todayPurchases, yesterdayPurchases };
}

export default async function MemberDashboard({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string }>;
}) {
  const session = await auth();
  if (!session) return null;

  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || 10;

  const { user, pointsHistory, pointsTotal, todayPurchases, yesterdayPurchases } = await getMemberData(session.user.id, page, limit);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-medium">Selamat datang,</h1>
        <h1 className="text-3xl font-bold">{user?.name}</h1>
        <p className="text-gray-600">Lihat profil dan poin keanggotaan</p>
      </div>

      {/* Member Card */}
      {user && (
        <MemberCard
          user={{
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            address: user.address,
            birthday: user.birthday,
            photoUrl: user.photoUrl,
            points: user.points,
            createdAt: user.createdAt,
          }}
          showMembershipId={true}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-semibold text-xl">
            <Award className="w-5 h-5" />
            Riwayat Poin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PointsHistoryTable 
            pointsHistory={pointsHistory}
            currentPage={page}
            pageSize={limit}
            totalItems={pointsTotal}
          />
        </CardContent>
      </Card>

      {/* Today's Purchase Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-semibold text-xl">
            <ShoppingBag className="w-5 h-5" />
            Pembelian Hari Ini
          </CardTitle>
        </CardHeader>
        <CardContent>
          
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-sm font-semibold">{todayPurchases.length}</p>
                  <p className="text-xs text-muted-foreground">Transaksi</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">
                    {todayPurchases.reduce((sum: number, p: typeof todayPurchases[number]) => sum + p.items.reduce((s: number, i: typeof p.items[number]) => s + i.quantity, 0), 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Item</p>
                </div>
              </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">
                    {formatCurrency(todayPurchases.reduce((sum: number, p: typeof todayPurchases[number]) => sum + Number(p.total), 0))}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Spent</p>
                </div>

              {/* Comparison with Yesterday */}
              {(() => {
                const todayTotal = todayPurchases.reduce((sum: number, p: typeof todayPurchases[number]) => sum + Number(p.total), 0);
                const yesterdayTotal = yesterdayPurchases.reduce((sum: number, p: typeof yesterdayPurchases[number]) => sum + Number(p.total), 0);
                if (yesterdayTotal === 0) return null;

                const percentageChange = ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100;
                const isIncrease = percentageChange > 0;

                return (
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-center gap-2">
                      <div className={`flex items-center gap-1 ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
                        {isIncrease ? (
                          <ArrowUp className="w-4 h-4" />
                        ) : (
                          <ArrowDown className="w-4 h-4" />
                        )}
                        <span className="font-semibold">
                          {Math.abs(percentageChange).toFixed(1)}%
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        vs yesterday ({formatCurrency(yesterdayTotal)})
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          
        </CardContent>
      </Card>
    </div>
  );
}