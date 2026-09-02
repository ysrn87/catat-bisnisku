import { redirect } from 'next/navigation';

export default async function AccountingRootPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/${slug}/admin/accounting/profit-loss`);
}
