import { auth } from '@/auth';
import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { PosPanel } from '@/components/pos/pos-panel';
import { getPointsConversionRate } from '@/actions/settings';

async function getPosData(storeId: string) {
  const variants = await db.productVariant.findMany({
    where: { storeId, isActive: true, product: { isActive: true }, OR: [{ stock: { gt: 0 } }, { type: 'PREORDER' }] },
    include: { product: { select: { name: true, categoryId: true } } },
    orderBy: { product: { name: 'asc' } },
  });

  const categoryIds = [...new Set(variants.map(v => v.product.categoryId).filter((id): id is string => !!id))];
  const categories  = categoryIds.length ? await db.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true, icon: true, color: true } }) : [];
  const catMap      = new Map(categories.map(c => [c.id, c]));

  return variants.map((v) => {
    const cat = v.product.categoryId ? catMap.get(v.product.categoryId) ?? null : null;
    return {
      id: v.id, name: v.name, price: Number(v.price), stock: v.stock,
      pointsPerUnit: v.pointsPerUnit, // FIX: points → pointsPerUnit
      barcode: v.barcode ?? null, type: v.type,
      product:  { name: v.product.name },
      category: cat ? { name: cat.name, icon: cat.icon ?? null, color: cat.color ?? null } : null,
    };
  });
}

async function getMembers(storeId: string) {
  const storeUsers = await db.storeUser.findMany({
    where: { storeId },
    include: { user: { select: { id: true, name: true } } },
  });
  // FIX: id harus StoreUser.id (dipakai sebagai memberId), bukan User.id
  return storeUsers.map((su) => ({ id: su.id, name: su.user.name, points: su.points }));
}

async function getNonMembers(storeId: string) {
  const customers = await db.customer.findMany({
    where: { storeId },
    select: { id: true, name: true, phone: true, address: true },
    orderBy: { name: 'asc' },
  });
  return customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone ?? '', address: c.address ?? null }));
}

export default async function AdminDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug }    = await params;
  const [{ storeId }, session] = await Promise.all([getStoreContext(), auth()]);

  const [posVariants, members, nonMembers, conversionRate, store] = await Promise.all([
    getPosData(storeId),
    getMembers(storeId),
    getNonMembers(storeId),
    getPointsConversionRate(),
    db.store.findUnique({ where: { id: storeId }, select: { name: true } }),
  ]);

  return (
    <PosPanel
      variants={posVariants}
      members={members}
      walkInCustomers={nonMembers}
      conversionRate={conversionRate}
      storeSlug={slug}
      storeName={store?.name ?? 'Toko'}
      cashierName={session?.user?.name ?? undefined}
    />
  );
}
