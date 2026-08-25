import { db } from '@/lib/db';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import InvitationClient from './invitation-client';

interface Props {
  searchParams: Promise<{ token?: string; action?: string }>;
}

export default async function InvitationPage({ searchParams }: Props) {
  const { token, action } = await searchParams;

  if (!token) redirect('/login');

  const session = await auth();

  const invitation = await db.staffInvitation.findUnique({
    where:   { token },
    include: {
      store:     { select: { name: true, slug: true, logoUrl: true } },
      invitedBy: { select: { name: true } },
    },
  });

  if (!invitation) {
    return <InvitationClient status="not-found" />;
  }

  if (invitation.status !== 'PENDING') {
    return <InvitationClient status={invitation.status.toLowerCase() as any} />;
  }

  if (invitation.expiresAt < new Date()) {
    return <InvitationClient status="expired" />;
  }

  // Belum login → redirect ke register atau login dengan token tersimpan
  if (!session?.user) {
    const existingUser = await db.user.findUnique({
      where:  { email: invitation.email },
      select: { id: true },
    });
    const redirectPath = existingUser
      ? `/login?callbackUrl=/invitation?token=${token}`
      : `/invitation/register?token=${token}`;
    redirect(redirectPath);
  }

  // Cek apakah akun yang login sesuai dengan email undangan
  const loggedInUser = await db.user.findUnique({
    where:  { id: session.user.id as string },
    select: { email: true },
  });

  if (loggedInUser?.email !== invitation.email) {
    return (
      <InvitationClient
        status="wrong-account"
        invitationEmail={invitation.email}
        currentEmail={loggedInUser?.email}
      />
    );
  }

  const roleLabel: Record<string, string> = {
    MANAGER:       'Manager',
    CASHIER:       'Kasir',
    ADMINISTRATOR: 'Administrator',
  };

  return (
    <InvitationClient
      status="pending"
      token={token}
      autoAccept={action === 'accept'}
      storeName={invitation.store.name}
      storeLogoUrl={invitation.store.logoUrl ?? undefined}
      inviterName={invitation.invitedBy.name}
      role={roleLabel[invitation.role] ?? invitation.role}
    />
  );
}
