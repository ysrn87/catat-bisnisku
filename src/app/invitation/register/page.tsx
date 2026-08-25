import { db } from '@/lib/db';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import RegisterInvitationClient from './register-invitation-client';

interface Props {
  searchParams: Promise<{ token?: string }>;
}

const ROLE_LABEL: Record<string, string> = {
  MANAGER:       'Manager',
  CASHIER:       'Kasir',
  ADMINISTRATOR: 'Administrator',
};

export default async function InvitationRegisterPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) redirect('/login');

  // Sudah login? Ini bukan halamannya — arahkan ke flow accept/decline biasa.
  const session = await auth();
  if (session?.user) redirect(`/invitation?token=${token}`);

  const invitation = await db.staffInvitation.findUnique({
    where:   { token },
    include: {
      store:     { select: { name: true, logoUrl: true } },
      invitedBy: { select: { name: true } },
    },
  });

  if (!invitation) {
    return <RegisterInvitationClient status="not-found" />;
  }
  if (invitation.status !== 'PENDING') {
    return (
      <RegisterInvitationClient
        status={invitation.status === 'ACCEPTED' ? 'accepted' : invitation.status === 'DECLINED' ? 'declined' : 'expired'}
      />
    );
  }
  if (invitation.expiresAt < new Date()) {
    return <RegisterInvitationClient status="expired" />;
  }

  // Kalau email undangan ternyata sudah punya akun berpassword, harusnya
  // dia login dulu, bukan daftar baru — arahkan ke flow yang benar.
  const existingUser = await db.user.findUnique({
    where:  { email: invitation.email },
    select: { password: true },
  });
  if (existingUser?.password) {
    redirect(`/login?callbackUrl=/invitation?token=${token}`);
  }

  return (
    <RegisterInvitationClient
      status="pending"
      token={token}
      email={invitation.email}
      storeName={invitation.store.name}
      storeLogoUrl={invitation.store.logoUrl ?? undefined}
      inviterName={invitation.invitedBy.name}
      role={ROLE_LABEL[invitation.role] ?? invitation.role}
    />
  );
}
