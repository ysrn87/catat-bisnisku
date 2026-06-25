import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { Store, ArrowRight, Crown, ShieldCheck, Users, Wallet } from 'lucide-react';

const roleIcon: Record<string, React.ReactNode> = {
  OWNER:         <Crown      className="w-4 h-4 text-amber-500" />,
  ADMINISTRATOR: <ShieldCheck className="w-4 h-4 text-blue-500" />,
  MANAGER:       <Users      className="w-4 h-4 text-green-500" />,
  CASHIER:       <Wallet     className="w-4 h-4 text-[#028697]" />,
  MEMBER:        <Users      className="w-4 h-4 text-gray-400" />,
};

const roleLabel: Record<string, string> = {
  OWNER:         'Pemilik',
  ADMINISTRATOR: 'Administrator',
  MANAGER:       'Manager',
  CASHIER:       'Kasir',
  MEMBER:        'Member',
};

export default async function StoreSelectPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const storeUsers = await db.storeUser.findMany({
    where: { userId: session.user.id },
    include: {
      store: {
        select: { id: true, name: true, slug: true, plan: true },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });

  // Kalau cuma punya 1 toko → langsung redirect
  if (storeUsers.length === 1) {
    redirect(`/${storeUsers[0].store.slug}`);
  }

  // Kalau tidak punya toko sama sekali → arahkan ke register
  if (storeUsers.length === 0) {
    redirect('/register');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Pilih Toko</h1>
          <p className="text-gray-500 mt-1">
            Halo, <span className="font-medium">{session.user.name}</span>. Kamu terdaftar di beberapa toko.
          </p>
        </div>

        <div className="space-y-3">
          {storeUsers.map(({ store, role }) => (
            <Link key={store.id} href={`/${store.slug}`}>
              <Card className="hover:border-[#028697] hover:shadow-md transition-all duration-200 cursor-pointer group">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#e0f9fc] rounded-lg group-hover:bg-[#028697]/10 transition-colors">
                      <Store className="w-5 h-5 text-[#028697]" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{store.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {roleIcon[role]}
                        <span className="text-xs text-gray-500">{roleLabel[role]}</span>
                        {store.plan === 'PRO' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                            PRO
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#028697] group-hover:translate-x-1 transition-all" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/register"
            className="text-sm text-[#028697] hover:underline"
          >
            + Daftarkan toko baru
          </Link>
        </div>
      </div>
    </div>
  );
}