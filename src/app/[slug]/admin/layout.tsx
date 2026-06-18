import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Navigation } from '@/components/navigation';
import { db } from '@/lib/db';

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();

  if (!session) {
    redirect(`/login?callbackUrl=/${slug}/admin`);
  }

  // Verifikasi user punya akses ADMINISTRATOR atau OWNER di store ini
  const storeUser = await db.storeUser.findFirst({
    where: {
      userId: session.user.id,
      store: { slug },
      role: { in: ['OWNER', 'ADMINISTRATOR'] },
    },
    include: {
      store: { select: { name: true, slug: true, plan: true } },
    },
  });

  if (!storeUser) {
    redirect('/unauthorized');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation
        role="ADMINISTRATOR"
        userName={session.user.name ?? undefined}
        storeSlug={slug}
        storeName={storeUser.store.name}
        storePlan={storeUser.store.plan as 'FREE' | 'PRO'}
      />
      <main className="container mx-auto px-4 py-6 pb-28 md:px-6 md:py-8 lg:pb-8 lg:ml-64">
        {children}
      </main>
    </div>
  );
}
