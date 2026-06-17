import Link from 'next/link';
import { CheckCircle2, Crown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default async function UpgradeSuccessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardContent className="pt-10 pb-8 text-center space-y-6">

          {/* Icon */}
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>

          {/* Text */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">
              <Crown className="w-3.5 h-3.5" /> SELAMAT, KAMU SUDAH PRO!
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Pembayaran Berhasil</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              Toko kamu sudah diupgrade ke PRO selama 30 hari.
              Semua fitur PRO sudah bisa digunakan sekarang.
            </p>
          </div>

          {/* Fitur yang unlocked */}
          <div className="bg-amber-50 rounded-xl p-4 text-left space-y-2">
            {[
              'Produk unlimited',
              'Manager unlimited',
              'Export laporan Excel',
              'Custom branding',
              'Prioritas support',
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-amber-800">
                <CheckCircle2 className="w-4 h-4 text-amber-500 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>

          {/* CTA */}
          <Button
            asChild
            className="w-full h-11 bg-[#028697] hover:bg-[#027080] text-white font-semibold"
          >
            <Link href={`/${slug}/admin`}>
              Ke Dasbor <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>

        </CardContent>
      </Card>
    </div>
  );
}
