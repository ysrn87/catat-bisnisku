import { getStoreContext } from '@/lib/store-context';
import { ProfileSettingsClient } from '@/components/settings/profile-settings-client';

export default async function ProfileSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug }                  = await params;
  const { storePlan, storeId }    = await getStoreContext();

  return <ProfileSettingsClient storePlan={storePlan} storeSlug={slug} storeId={storeId} />;
}
