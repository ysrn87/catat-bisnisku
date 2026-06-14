import Link from 'next/link';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ShoppingCart, Package, Users, TrendingUp,
  BarChart2, Coins, CheckCircle2, XCircle,
  ArrowRight, Store,
} from 'lucide-react';

const features = [
  { icon: ShoppingCart, title: 'Kasir & Penjualan',    desc: 'Catat transaksi cepat, support member & walk-in customer, barcode scan.' },
  { icon: Package,      title: 'Manajemen Inventori',  desc: 'Kelola produk, varian, dan stok. Alert otomatis saat stok menipis.' },
  { icon: Users,        title: 'Loyalty Member',       desc: 'Sistem poin otomatis. Member dapat poin setiap pembelian, bisa ditukar diskon.' },
  { icon: TrendingUp,   title: 'Laporan Keuangan',     desc: 'Cashflow income & expense real-time. Lihat profit bersih setiap saat.' },
  { icon: BarChart2,    title: 'Rekap Penjualan',      desc: 'Analisis produk terlaris per periode. Bantu keputusan bisnis lebih akurat.' },
  { icon: Coins,        title: 'Multi-Role Akses',     desc: 'Owner, Admin, Manager — tiap role punya akses yang sesuai tugasnya.' },
];

const plans = [
  {
    name: 'FREE',
    price: 'Gratis',
    period: 'selamanya',
    highlight: false,
    features: [
      { label: 'Hingga 50 produk',       ok: true },
      { label: 'Hingga 2 Manager',        ok: true },
      { label: 'Kasir & Penjualan',       ok: true },
      { label: 'Sistem Poin Member',      ok: true },
      { label: 'Laporan & Rekap',         ok: true },
      { label: 'Produk unlimited',        ok: false },
      { label: 'Manager unlimited',       ok: false },
      { label: 'Export laporan (Excel)',  ok: false },
      { label: 'Custom branding',         ok: false },
    ],
    cta: 'Mulai Gratis',
    ctaHref: '/register-store',
  },
  {
    name: 'PRO',
    price: 'Rp 99.000',
    period: '/ bulan',
    highlight: true,
    features: [
      { label: 'Produk unlimited',        ok: true },
      { label: 'Manager unlimited',       ok: true },
      { label: 'Kasir & Penjualan',       ok: true },
      { label: 'Sistem Poin Member',      ok: true },
      { label: 'Laporan & Rekap',         ok: true },
      { label: 'Export laporan (Excel)',  ok: true },
      { label: 'Custom branding',         ok: true },
      { label: 'Prioritas support',       ok: true },
    ],
    cta: 'Coba PRO',
    ctaHref: '/register-store?plan=pro',
  },
];

export default async function LandingPage() {
  const session = await auth();

  // User yang sudah login langsung diarahkan ke store-select
  if (session) {
    redirect('/store-select');
  }

  return (
    <div className="min-h-screen bg-white">

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="w-6 h-6 text-[#00a090]" />
            <span className="text-lg font-bold text-[#00a090]">Catat Bisnisku</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-[#00a090]">
                Masuk
              </Button>
            </Link>
            <Link href="/register-store">
              <Button size="sm" className="bg-[#00a090] hover:bg-[#007060] text-white">
                Daftar Toko
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="bg-gradient-to-br from-[#e0f5f2] via-[#f0faf8] to-white pt-20 pb-28 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-[#00a090]/10 text-[#00a090] text-sm font-medium px-4 py-1.5 rounded-full">
            <span className="w-2 h-2 bg-[#00a090] rounded-full animate-pulse" />
            Aplikasi Manajemen Toko untuk UMKM Indonesia
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
            Catat semua transaksi
            <span className="text-[#00a090] block">bisnis kamu.</span>
          </h1>

          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            POS, inventori, loyalty member, dan laporan keuangan dalam satu aplikasi.
            Gratis untuk memulai — upgrade kapan saja.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href="/register-store">
              <Button size="lg" className="bg-[#00a090] hover:bg-[#007060] text-white px-8 h-12 text-base shadow-lg hover:shadow-xl transition-all">
                Buat Toko Gratis
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-[#00a090] text-[#00a090] hover:bg-[#e0f5f2] px-8 h-12 text-base">
                Masuk ke Toko
              </Button>
            </Link>
          </div>

          <p className="text-xs text-gray-400">
            Tidak perlu kartu kredit. Gratis selamanya untuk plan FREE.
          </p>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Semua yang kamu butuhkan</h2>
            <p className="text-gray-500 mt-2">Satu aplikasi untuk semua operasi toko harian</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <Card key={f.title} className="border border-gray-100 hover:border-[#00a090]/30 hover:shadow-md transition-all duration-200">
                <CardHeader className="pb-3">
                  <div className="w-10 h-10 bg-[#e0f5f2] rounded-xl flex items-center justify-center mb-3">
                    <f.icon className="w-5 h-5 text-[#00a090]" />
                  </div>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-20 px-4 bg-gray-50" id="pricing">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Harga yang transparan</h2>
            <p className="text-gray-500 mt-2">Mulai gratis, upgrade saat bisnis berkembang</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 border-2 flex flex-col ${
                  plan.highlight
                    ? 'border-[#00a090] bg-white shadow-xl relative'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-[#00a090] text-white text-xs font-bold px-4 py-1 rounded-full">
                      PALING POPULER
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-[#00a090]">{plan.price}</span>
                    <span className="text-sm text-gray-400">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map((f) => (
                    <li key={f.label} className="flex items-center gap-2.5 text-sm">
                      {f.ok
                        ? <CheckCircle2 className="w-4 h-4 text-[#00a090] flex-shrink-0" />
                        : <XCircle      className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      }
                      <span className={f.ok ? 'text-gray-700' : 'text-gray-400'}>{f.label}</span>
                    </li>
                  ))}
                </ul>

                <Link href={plan.ctaHref}>
                  <Button
                    className={`w-full h-11 font-semibold ${
                      plan.highlight
                        ? 'bg-[#00a090] hover:bg-[#007060] text-white shadow-lg'
                        : 'bg-white border-2 border-[#00a090] text-[#00a090] hover:bg-[#e0f5f2]'
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BOTTOM ── */}
      <section className="py-20 px-4 bg-[#00a090]">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold text-white">Siap mulai?</h2>
          <p className="text-[#90e0d8]">
            Daftar sekarang dan mulai kelola toko kamu dalam hitungan menit.
            Tidak ada yang perlu diinstall.
          </p>
          <Link href="/register-store">
            <Button size="lg" className="bg-white text-[#00a090] hover:bg-[#e0f5f2] px-8 h-12 text-base font-semibold shadow-lg">
              Buat Toko Gratis Sekarang
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-8 px-4 bg-gray-900 text-center">
        <p className="text-gray-500 text-sm">
          © {new Date().getFullYear()} Catat Bisnisku. Dibuat untuk UMKM Indonesia.
        </p>
      </footer>

    </div>
  );
}
