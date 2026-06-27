import { auth } from '@/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';

export default async function StoreRootPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session  = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/${slug}`);

  const store = await db.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) redirect('/store-select');

  // UPDATED: cek StoreStaff dulu, jika tidak ada cek StoreUser (member)
  const [staffRecord, memberRecord] = await Promise.all([
    db.storeStaff.findUnique({
      where:  { storeId_userId: { storeId: store.id, userId: session.user.id } },
      select: { role: true },
    }),
    db.storeUser.findUnique({
      where:  { storeId_userId: { storeId: store.id, userId: session.user.id } },
      select: { id: true },
    }),
  ]);

  if (staffRecord) {
    switch (staffRecord.role) {
      case 'OWNER':
      case 'ADMINISTRATOR': redirect(`/${slug}/admin`);   break;
      case 'MANAGER':       redirect(`/${slug}/manager`); break;
      case 'CASHIER':       redirect(`/${slug}/cashier`); break;
    }
  }

  if (memberRecord) redirect(`/${slug}/member`);

  redirect('/store-select');
}
