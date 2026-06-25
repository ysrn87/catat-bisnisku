import { auth } from '@/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';

export default async function StoreRootPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session  = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/${slug}`);
  }

  const store = await db.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) redirect('/store-select');

  // FIX: routing berdasarkan StoreUser.role, bukan session.user.role
  const storeUser = await db.storeUser.findUnique({
    where:  { storeId_userId: { storeId: store.id, userId: session.user.id } },
    select: { role: true },
  });

  if (!storeUser) redirect('/store-select');

  switch (storeUser.role) {
    case 'OWNER':
    case 'ADMINISTRATOR': redirect(`/${slug}/admin`);         break;
    case 'MANAGER':       redirect(`/${slug}/manager`);       break;
    case 'CASHIER':       redirect(`/${slug}/cashier`);       break;
    case 'MEMBER':
    case 'CUSTOMER':      redirect(`/${slug}/member`);        break;
    default:              redirect('/store-select');
  }
}
