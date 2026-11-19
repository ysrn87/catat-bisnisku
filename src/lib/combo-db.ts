import type { Prisma } from '@prisma/client';
import type { ComboInfo } from './combo-pricing';

/** Include standar: paket + slot (produk) + varian yang boleh dipilih. */
export const comboWithSlotsInclude = {
  items: {
    orderBy: { sortOrder: 'asc' },
    include: {
      product:  { select: { name: true } },
      variants: {
        orderBy: { sortOrder: 'asc' },
        include: { variant: true },
      },
    },
  },
} satisfies Prisma.ComboInclude;

export type ComboWithSlots = Prisma.ComboGetPayload<{ include: typeof comboWithSlotsInclude }>;

export function toComboInfo(c: ComboWithSlots, opts: { activeOnly?: boolean } = {}): ComboInfo {
  return {
    id:    c.id,
    name:  c.name,
    price: Number(c.price),
    slots: c.items.map((item) => ({
      id:          item.id,
      productId:   item.productId,
      productName: item.product.name,
      isRequired:  item.isRequired,
      variants: item.variants
        .map((cv) => cv.variant)
        .filter((v) => !opts.activeOnly || v.isActive)
        .map((v) => ({
          id:            v.id,
          name:          v.name,
          price:         Number(v.price),
          stock:         v.stock,
          type:          v.type,
          isActive:      v.isActive,
          pointsPerUnit: v.pointsPerUnit,
        })),
    })),
  };
}
