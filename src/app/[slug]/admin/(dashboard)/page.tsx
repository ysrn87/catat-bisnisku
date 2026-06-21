import { auth } from '@/auth';
import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { PosPanel } from '@/components/pos/pos-panel';
import { getPointsConversionRate } from '@/actions/settings';

// ─── Data fetchers ─────────────────────────────────────────────────────────────

async function getPosVariants(storeId: string) {
  const variants = await db.productVariant.findMany({
    where: {
      storeId,
      isActive: true,
      product: { isActive: true },
      OR: [{ stock: { gt: 0 } }, { type: 'PREORDER' }],
    },
    include: { product: { select: { name: true, categoryId: true } } },
    orderBy: { product: { name: 'asc' } },
  });

  const categoryIds = [...new Set(
    variants.map(v => v.product.categoryId).filter((id): id is string => !!id)
  )];
  const categories = categoryIds.length
    ? await db.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, icon: true, color: true },
      })
    : [];
  const catMap = new Map(categories.map(c => [c.id, c]));

  return variants.map((v) => {
    const cat = v.product.categoryId ? catMap.get(v.product.categoryId) ?? null : null;
    return {
      id: v.id,
      name: v.name,
      price: Number(v.price),
      stock: v.stock,
      points: v.points,
      barcode: v.barcode ?? null,
      type: v.type,
      product: { name: v.product.name },
      category: cat
        ? { name: cat.name, icon: cat.icon ?? null, color: cat.color ?? null }
        : null,
    };
  });
}

async function getMembers(storeId: string) {
  const storeUsers = await db.storeUser.findMany({
    where: { storeId, role: 'MEMBER' },
    include: { user: { select: { id: true, name: true, points: true } } },
  });
  return storeUsers.map((su) => su.user);
}

async function getNonMembers(storeId: string) {
  const customers = await db.customer.findMany({
    where: { storeId },
    select: { id: true, name: true, phone: true, address: true },
    orderBy: { name: 'asc' },
  });
  return customers.map((c) => ({ ...c, address: c.address ?? null }));
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function PosKasirPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { storeId } = await getStoreContext();

  const [posVariants, members, nonMembers, conversionRate, store, session] = await Promise.all([
    getPosVariants(storeId),
    getMembers(storeId),
    getNonMembers(storeId),
    getPointsConversionRate(),
    db.store.findUnique({ where: { id: storeId }, select: { name: true } }),
    auth(),
  ]);

  return (
    <PosPanel
      variants={posVariants}
      members={members}
      nonMembers={nonMembers}
      conversionRate={conversionRate}
      storeSlug={slug}
      storeName={store?.name ?? 'Toko'}
      cashierName={session?.user?.name ?? undefined}
    />
  );
}


