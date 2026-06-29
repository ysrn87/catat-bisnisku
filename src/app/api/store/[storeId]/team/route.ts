import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { storeId } = await params;

  // Verifikasi user adalah staff di toko ini
  const staff = await db.storeStaff.findUnique({
    where:  { storeId_userId: { storeId, userId: session.user.id as string } },
    select: { role: true },
  });

  if (!staff || (staff.role !== 'OWNER' && staff.role !== 'ADMINISTRATOR')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [staffRecords, pendingInvites] = await Promise.all([
    db.storeStaff.findMany({
      where:   { storeId, role: { in: ['MANAGER', 'CASHIER'] } },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    }),
    db.staffInvitation.findMany({
      where:   { storeId, status: 'PENDING', expiresAt: { gt: new Date() } },
      select:  { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const managers = staffRecords
    .filter((s) => s.role === 'MANAGER')
    .map((s) => ({
      userId:   s.user.id,
      name:     s.user.name,
      email:    s.user.email,
      role:     s.role,
      joinedAt: s.joinedAt,
    }));

  const cashiers = staffRecords
    .filter((s) => s.role === 'CASHIER')
    .map((s) => ({
      userId:   s.user.id,
      name:     s.user.name,
      email:    s.user.email,
      role:     s.role,
      joinedAt: s.joinedAt,
    }));

  return NextResponse.json({ managers, cashiers, pendingInvites });
}
