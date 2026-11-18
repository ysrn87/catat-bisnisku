import { auth } from '@/auth';
import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { DeleteStoreSection } from '@/components/settings/delete-store-section';

export default async function DangerZonePage() {
  const { storeId } = await getStoreContext();
  const session     = await auth();

  const [store, products, sales, staff] = await Promise.all([
    db.store.findUnique({
      where:  { id: storeId },
      select: { name: true, ownerId: true, plan: true, planExpiresAt: true },
    }),
    db.product.count({ where: { storeId } }),
    db.sale.count({ where: { storeId } }),
    db.storeStaff.count({ where: { storeId } }),
  ]);
  if (!store) return null;

  const isActivePro = store.plan === 'PRO' && !!store.planExpiresAt && store.planExpiresAt > new Date();

  return (
    <DeleteStoreSection
      storeId={storeId}
      storeName={store.name}
      isOwner={store.ownerId === session?.user?.id}
      isActivePro={isActivePro}
      stats={{ products, sales, staff }}
    />
  );
}
