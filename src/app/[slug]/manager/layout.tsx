import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Navigation } from '@/components/navigation';
import { NavigationLoader } from '@/components/layouts/navigation-loader';
import { db } from '@/lib/db';

export default async function ManagerLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session  = await auth();
  if (!session) redirect(`/login?callbackUrl=/${slug}/manager`);

  // UPDATED: query ke StoreStaff
  const staffRecord = await db.storeStaff.findFirst({
    where: { userId: session.user.id, store: { slug }, role: { in: ['OWNER', 'ADMINISTRATOR', 'MANAGER'] } },
    include: { store: { select: { name: true, slug: true, plan: true } } },
  });
  if (!staffRecord) redirect('/unauthorized');

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationLoader />
      <Navigation
        role="MANAGER"
        userName={session.user.name ?? undefined}
        storeSlug={slug}
        storeName={staffRecord.store.name}
        storePlan={staffRecord.store.plan as 'FREE' | 'PRO'}
      />
      <main className="px-4 py-6 pb-28 md:px-6 md:py-8 lg:pb-8 lg:ml-60 lg:px-8 lg:pt-24">{children}</main>
    </div>
  );
}
