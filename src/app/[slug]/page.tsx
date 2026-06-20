import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

export default async function StoreRootPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();

  if (!session) {
    redirect(`/login?callbackUrl=/${slug}`);
  }

  const storeUser = await db.storeUser.findFirst({
    where: {
      userId: session.user.id,
      store: { slug },
    },
  });

  if (!storeUser) {
    redirect('/unauthorized');
  }

  // Redirect ke halaman yang sesuai dengan role
  switch (storeUser.role) {
    case 'OWNER':
    case 'ADMINISTRATOR':
      redirect(`/${slug}/admin`);
    case 'MANAGER':
      redirect(`/${slug}/manager`);
    case 'CASHIER':
      redirect(`/${slug}/cashier`);
    case 'MEMBER':
      redirect(`/${slug}/member`);
    default:
      redirect('/unauthorized');
  }
}
