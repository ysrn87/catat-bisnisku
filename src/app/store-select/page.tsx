import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import {
  Store,
  ArrowRight,
  Crown,
  ShieldCheck,
  Users,
  Wallet,
  Briefcase,
  UserCircle,
} from 'lucide-react';

const STAFF_ROLES = ['OWNER', 'ADMINISTRATOR', 'MANAGER', 'CASHIER'];
const MEMBER_ROLES = ['MEMBER'];

const roleIcon: Record<string, React.ReactNode> = {
  OWNER: <Crown className="w-4 h-4 text-amber-500" />,
  ADMINISTRATOR: <ShieldCheck className="w-4 h-4 text-blue-500" />,
  MANAGER: <Users className="w-4 h-4 text-green-500" />,
  CASHIER: <Wallet className="w-4 h-4 text-[#028697]" />,
};

const roleLabel: Record<string, string> = {
  OWNER: 'Pemilik',
  ADMINISTRATOR: 'Administrator',
  MANAGER: 'Manager',
  CASHIER: 'Kasir',
};

type StoreUserWithStore = {
  role: string;
  store: { id: string; name: string; slug: string; plan: string };
};

export default async function StoreSelectPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { view } = await searchParams;

  const storeUsers = await db.storeUser.findMany({
    where: { userId: session.user.id },
    include: {
      store: { select: { id: true, name: true, slug: true, plan: true } },
    },
    orderBy: { joinedAt: 'asc' },
  });

  const staffStores = storeUsers.filter((su: { role: string }) =>
    STAFF_ROLES.includes(su.role),
  );
  const memberStores = storeUsers.filter((su: { role: string }) =>
    MEMBER_ROLES.includes(su.role),
  );

  // Tidak punya toko sama sekali (baru daftar, belum pernah jadi staff/member di mana pun)
  if (staffStores.length === 0 && memberStores.length === 0) {
    redirect('/join-store');
  }

  // Hanya member/customer di satu toko, tidak pernah jadi staff sama sekali
  if (staffStores.length === 0 && memberStores.length === 1) {
    redirect(`/${memberStores[0].store.slug}/member`);
  }

  // Hanya staff di satu toko, tidak pernah jadi member/customer sama sekali
  if (staffStores.length === 1 && memberStores.length === 0) {
    redirect(`/${staffStores[0].store.slug}`);
  }

  // Member/customer di banyak toko, tidak pernah jadi staff sama sekali → ringkasan member
  if (staffStores.length === 0 && memberStores.length > 1) {
    redirect('/member-select');
  }

  // Datang dari kartu "Pengelola" di category picker, atau tidak ada toko member sama sekali
  const showStaffList = view === 'staff' || memberStores.length === 0;

  if (showStaffList) {
    return <StaffList stores={staffStores} userName={session.user.name} />;
  }

  // Punya kedua kategori (staff di beberapa/satu toko, dan member/customer di toko lain)
  return (
    <CategoryPicker
      staffCount={staffStores.length}
      memberCount={memberStores.length}
      userName={session.user.name}
      singleStaffSlug={staffStores.length === 1 ? staffStores[0].store.slug : null}
    />
  );
}

function StaffList({
  stores,
  userName,
}: {
  stores: StoreUserWithStore[];
  userName?: string | null;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Pilih Toko</h1>
          <p className="text-gray-500 mt-1">
            Halo, <span className="font-medium">{userName}</span>. Kamu mengelola
            beberapa toko.
          </p>
        </div>

        <div className="space-y-3">
          {stores.map(({ store, role }) => (
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
          <Link href="/register-store" className="text-sm text-[#028697] hover:underline">
            + Daftarkan toko baru
          </Link>
        </div>
      </div>
    </div>
  );
}

function CategoryPicker({
  staffCount,
  memberCount,
  userName,
  singleStaffSlug,
}: {
  staffCount: number;
  memberCount: number;
  userName?: string | null;
  singleStaffSlug: string | null;
}) {
  const staffHref = singleStaffSlug ? `/${singleStaffSlug}` : '/store-select?view=staff';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Masuk sebagai</h1>
          <p className="text-gray-500 mt-1">
            Halo, <span className="font-medium">{userName}</span>. Pilih bagaimana
            kamu mau masuk.
          </p>
        </div>

        <div className="space-y-3">
          <Link href={staffHref}>
            <Card className="hover:border-[#028697] hover:shadow-md transition-all duration-200 cursor-pointer group">
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#e0f9fc] rounded-lg group-hover:bg-[#028697]/10 transition-colors">
                    <Briefcase className="w-5 h-5 text-[#028697]" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Pengelola</p>
                    <p className="text-xs text-gray-500">{staffCount} toko</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#028697] group-hover:translate-x-1 transition-all" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/member-select">
            <Card className="hover:border-amber-400 hover:shadow-md transition-all duration-200 cursor-pointer group">
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
                    <UserCircle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Member</p>
                    <p className="text-xs text-gray-500">{memberCount} toko</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
