import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowRight, Sparkles, Store as StoreIcon, Briefcase } from 'lucide-react';

export default async function MemberSelectPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  // UPDATED: member dari StoreUser, staff dari StoreStaff (terpisah)
  const [memberRecords, staffCount] = await Promise.all([
    db.storeUser.findMany({
      where:   { userId: session.user.id },
      include: { store: { select: { id: true, name: true, slug: true } } },
      orderBy: { joinedAt: 'asc' },
    }),
    db.storeStaff.count({ where: { userId: session.user.id } }),
  ]);

  if (memberRecords.length === 0) redirect('/store-select');
  if (memberRecords.length === 1) redirect(`/${memberRecords[0].store.slug}/member`);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Toko Kamu</h1>
          <p className="text-gray-500 mt-1">
            Halo, <span className="font-medium">{session.user.name}</span>. Berikut poin kamu di setiap toko.
          </p>
        </div>

        <div className="space-y-3">
          {memberRecords.map(({ store, points }) => (
            <Link key={store.id} href={`/${store.slug}/member`}>
              <Card className="hover:border-amber-400 hover:shadow-md transition-all duration-200 cursor-pointer group">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
                      <StoreIcon className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{store.name}</p>
                      <p className="text-xs text-gray-500">Member</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-amber-600 font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{points.toLocaleString('id-ID')}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {staffCount > 0 && (
          <div className="text-center">
            <Link
              href="/store-select?view=staff"
              className="inline-flex items-center gap-1.5 text-sm text-[#028697] hover:underline"
            >
              <Briefcase className="w-3.5 h-3.5" />
              Lihat sebagai Pengelola
            </Link>
          </div>
        )}

        <div className="text-center">
          <Link href="/join-store" className="text-sm text-gray-500 hover:underline">
            + Gabung toko lain
          </Link>
        </div>
      </div>
    </div>
  );
}
