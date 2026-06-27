import { db } from '@/lib/db';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Crown, CheckCircle2, Zap, Package,
  Users, FileDown, Palette, ArrowLeft,
} from 'lucide-react';
import { PlanLimitBar } from '@/components/plan/plan-limit-bar';
import { UpgradeButton } from '@/components/plan/upgrade-button';
import { PLAN_LIMITS } from '@/lib/store-context';

const proFeatures = [
  { icon: Package,  label: 'Hingga 1.000 produk',        desc: 'Maksimal 10 varian per produk' },
  { icon: Users,    label: 'Hingga 5 manager',           desc: 'Kelola toko dengan lebih banyak staf' },
  { icon: FileDown, label: 'Export laporan (Excel)',      desc: 'Download semua laporan dalam format Excel' },
  { icon: Palette,  label: 'Custom branding',            desc: 'Upload logo toko sesuai brand kamu' },
  { icon: Crown,    label: 'Transaksi harian unlimited', desc: 'Tidak ada batas jumlah transaksi per hari' },
];

export default async function UpgradePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session  = await auth();

  if (!session) redirect(`/login?callbackUrl=/${slug}/upgrade`);

  const store = await db.store.findUnique({
    where: { slug },
    select: { id: true, name: true, plan: true },
  });

  if (!store) redirect('/store-select');

  // Kalau sudah PRO redirect ke admin
  if (store.plan === 'PRO') redirect(`/${slug}/admin`);

  // Ambil usage stats
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [productCount, managerCount, todayTxCount] = await Promise.all([
    db.product.count({ where: { storeId: store.id } }),
    db.storeStaff.count({ where: { storeId: store.id, role: 'MANAGER' } }),
    db.sale.count({ where: { storeId: store.id, createdAt: { gte: startOfDay } } }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 py-12">
      <div className="w-full max-w-2xl space-y-6">

        {/* Back */}
        <Link
          href={`/${slug}/admin`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#028697] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke dasbor
        </Link>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center shadow-sm">
            <Crown className="w-7 h-7 text-amber-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Upgrade ke PRO</h1>
          <p className="text-gray-500">
            Buka semua fitur untuk <span className="font-semibold text-gray-700">{store.name}</span>
          </p>
        </div>

        {/* Usage saat ini */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#028697]" />
              Penggunaan Plan FREE Kamu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PlanLimitBar
              label="Produk"
              current={productCount}
              limit={PLAN_LIMITS.FREE.products}
              plan="FREE"
              storeSlug={slug}
              upgradeText={`Upgrade ke PRO untuk hingga ${PLAN_LIMITS.PRO.products} produk`}
            />
            <PlanLimitBar
              label="Manager"
              current={managerCount}
              limit={PLAN_LIMITS.FREE.managers}
              plan="FREE"
              storeSlug={slug}
              upgradeText={`Upgrade ke PRO untuk hingga ${PLAN_LIMITS.PRO.managers} manager`}
            />
            <PlanLimitBar
              label="Transaksi Hari Ini"
              current={todayTxCount}
              limit={PLAN_LIMITS.FREE.dailyTransactions}
              plan="FREE"
              storeSlug={slug}
              upgradeText="Upgrade ke PRO untuk transaksi unlimited"
            />
          </CardContent>
        </Card>

        {/* PRO Card */}
        <Card className="border-2 border-amber-400 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />

          <CardHeader className="pb-4 text-center">
            <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full mx-auto mb-2">
              <Crown className="w-3.5 h-3.5" /> PLAN PRO
            </div>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold text-gray-900">Rp 99.000</span>
              <span className="text-gray-400 text-sm">/ bulan</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Bisa dibatalkan kapan saja</p>
          </CardHeader>

          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {proFeatures.map((f) => (
                <li key={f.label} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <f.icon className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{f.label}</p>
                    <p className="text-xs text-gray-400">{f.desc}</p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto flex-shrink-0 mt-1" />
                </li>
              ))}
            </ul>

            {/* CTA — Midtrans Snap */}
            <div className="pt-2">
              <UpgradeButton storeSlug={slug} />
            </div>
          </CardContent>
        </Card>

        {/* FAQ singkat */}
        <Card className="bg-white border border-gray-100">
          <CardContent className="pt-5 space-y-4">
            {[
              { q: 'Kapan upgrade mulai berlaku?', a: 'Langsung setelah pembayaran dikonfirmasi.' },
              { q: 'Apakah data saya aman saat upgrade?', a: 'Ya, semua data toko tetap utuh saat upgrade maupun downgrade.' },
              { q: 'Bisa downgrade ke FREE?', a: 'Bisa, tapi data yang melebihi batas FREE akan tetap ada (hanya tidak bisa tambah baru).' },
            ].map((item) => (
              <div key={item.q}>
                <p className="text-sm font-semibold text-gray-800">{item.q}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.a}</p>
              </div>
            ))}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
