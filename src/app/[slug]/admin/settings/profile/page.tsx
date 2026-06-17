import { getStoreContext } from '@/lib/store-context';
import { ProfileSettingsClient } from '@/components/settings/profile-settings-client';

/**
 * Server wrapper untuk settings/profile.
 * Ambil storePlan dari server lalu kirim ke client component.
 */
export default async function ProfileSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { storePlan } = await getStoreContext();

  return <ProfileSettingsClient storePlan={storePlan} storeSlug={slug} />;
}
