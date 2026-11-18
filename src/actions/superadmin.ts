'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getSuperAdmin } from '@/lib/superadmin';
import {
  LIMIT_KEYS,
  LIMIT_LABELS,
  MAX_LIMIT_VALUE,
  UNLIMITED,
  type LimitKey,
  type RawLimits,
} from '@/lib/limit-constants';

type ActionResult = { success: boolean; error?: string; message?: string };
type LimitChanges = Partial<Record<LimitKey, { from: number | null; to: number | null }>>;

const FORBIDDEN: ActionResult = { success: false, error: 'Akses ditolak.' };

/** Baca 4 field batas dari form: mode default | custom | unlimited (+ angka bila custom). */
function parseLimits(formData: FormData): { ok: true; values: RawLimits } | { ok: false; error: string } {
  const values = {} as RawLimits;

  for (const key of LIMIT_KEYS) {
    const mode = formData.get(`${key}_mode`);

    if (mode === 'default') {
      values[key] = null;
    } else if (mode === 'unlimited') {
      values[key] = UNLIMITED;
    } else if (mode === 'custom') {
      const raw = String(formData.get(key) ?? '').trim();
      if (!/^\d+$/.test(raw)) {
        return { ok: false, error: `${LIMIT_LABELS[key]}: isi angka bulat positif.` };
      }
      const n = parseInt(raw, 10);
      if (n < 1 || n > MAX_LIMIT_VALUE) {
        return { ok: false, error: `${LIMIT_LABELS[key]}: harus antara 1 dan ${MAX_LIMIT_VALUE.toLocaleString('id-ID')}.` };
      }
      values[key] = n;
    } else {
      return { ok: false, error: `${LIMIT_LABELS[key]}: pilihan tidak valid.` };
    }
  }

  return { ok: true, values };
}

function pickRaw(row: Partial<RawLimits> | null | undefined): RawLimits {
  return {
    products:           row?.products           ?? null,
    variantsPerProduct: row?.variantsPerProduct ?? null,
    managers:           row?.managers           ?? null,
    cashiers:           row?.cashiers           ?? null,
  };
}

function diffLimits(before: RawLimits, after: RawLimits): LimitChanges {
  const changes: LimitChanges = {};
  for (const key of LIMIT_KEYS) {
    if (before[key] !== after[key]) changes[key] = { from: before[key], to: after[key] };
  }
  return changes;
}

// ─── Batas per toko (override) ────────────────────────────────────────────────

export async function updateStoreLimitsAction(formData: FormData): Promise<ActionResult> {
  const admin = await getSuperAdmin();
  if (!admin) return FORBIDDEN;

  const storeId = String(formData.get('storeId') ?? '');
  if (!storeId) return { success: false, error: 'Toko tidak valid.' };

  const parsed = parseLimits(formData);
  if (!parsed.ok) return { success: false, error: parsed.error };

  try {
    const store = await db.store.findUnique({
      where:  { id: storeId },
      select: { id: true, name: true, slug: true },
    });
    if (!store) return { success: false, error: 'Toko tidak ditemukan.' };

    const existing = await db.storeLimitOverride.findUnique({ where: { storeId } });
    const changes  = diffLimits(pickRaw(existing), parsed.values);
    if (Object.keys(changes).length === 0) {
      return { success: true, message: 'Tidak ada perubahan.' };
    }

    const allDefault = LIMIT_KEYS.every((k) => parsed.values[k] === null);

    await db.$transaction([
      allDefault
        ? db.storeLimitOverride.deleteMany({ where: { storeId } })
        : db.storeLimitOverride.upsert({
            where:  { storeId },
            create: { storeId, ...parsed.values, updatedById: admin.id },
            update: { ...parsed.values, updatedById: admin.id },
          }),
      db.superAdminAuditLog.create({
        data: {
          actorId:     admin.id,
          actorEmail:  admin.email,
          scope:       'STORE',
          targetId:    store.id,
          targetLabel: `${store.name} (${store.slug})`,
          changes:     changes as Prisma.InputJsonValue,
        },
      }),
    ]);

    revalidatePath('/superadmin');
    revalidatePath(`/superadmin/stores/${store.id}`);
    revalidatePath('/superadmin/audit');
    revalidatePath(`/${store.slug}/admin/settings/subscription`);

    return { success: true, message: 'Batas toko disimpan.' };
  } catch (error) {
    console.error('updateStoreLimitsAction error:', error);
    return { success: false, error: 'Gagal menyimpan batas toko.' };
  }
}

// ─── Batas global per paket ───────────────────────────────────────────────────

export async function updatePlanLimitsAction(formData: FormData): Promise<ActionResult> {
  const admin = await getSuperAdmin();
  if (!admin) return FORBIDDEN;

  const plan = formData.get('plan');
  if (plan !== 'FREE' && plan !== 'PRO') return { success: false, error: 'Paket tidak valid.' };

  const parsed = parseLimits(formData);
  if (!parsed.ok) return { success: false, error: parsed.error };

  try {
    const existing = await db.planLimitConfig.findUnique({ where: { plan } });
    const changes  = diffLimits(pickRaw(existing), parsed.values);
    if (Object.keys(changes).length === 0) {
      return { success: true, message: 'Tidak ada perubahan.' };
    }

    await db.$transaction([
      db.planLimitConfig.upsert({
        where:  { plan },
        create: { plan, ...parsed.values, updatedById: admin.id },
        update: { ...parsed.values, updatedById: admin.id },
      }),
      db.superAdminAuditLog.create({
        data: {
          actorId:     admin.id,
          actorEmail:  admin.email,
          scope:       'PLAN',
          targetId:    plan,
          targetLabel: `Paket ${plan}`,
          changes:     changes as Prisma.InputJsonValue,
        },
      }),
    ]);

    revalidatePath('/superadmin', 'layout');

    return { success: true, message: `Batas paket ${plan} disimpan.` };
  } catch (error) {
    console.error('updatePlanLimitsAction error:', error);
    return { success: false, error: 'Gagal menyimpan batas paket.' };
  }
}
