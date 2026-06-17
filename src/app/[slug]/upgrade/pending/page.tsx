import Link from 'next/link';
import { Clock, ArrowRight, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default async function UpgradePendingPage({
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
          <div className="mx-auto w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center">
            <Clock className="w-10 h-10 text-yellow-500" />
          </div>

          {/* Text */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">Menunggu Pembayaran</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              Toko kamu akan diupgrade ke PRO secara otomatis setelah
              pembayaran dikonfirmasi. Biasanya dalam <strong>beberapa menit</strong> hingga
              <strong> 1 hari kerja</strong> tergantung metode pembayaran.
            </p>
          </div>

          {/* Info */}
          <div className="bg-blue-50 rounded-xl p-4 text-left space-y-2 text-sm text-blue-800">
            <p className="font-semibold">Yang perlu kamu lakukan:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Selesaikan pembayaran sesuai instruksi dari Midtrans</li>
              <li>Simpan bukti pembayaran</li>
              <li>Toko akan upgrade otomatis setelah dikonfirmasi</li>
            </ol>
          </div>

          <p className="text-xs text-gray-400">
            Ada pertanyaan?{' '}
            <a
              href="https://wa.me/6281234567890?text=Halo,%20saya%20sudah%20bayar%20PRO%20tapi%20belum%20aktif"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#028697] font-medium hover:underline"
            >
              Chat WhatsApp
            </a>
          </p>

          <Button
            asChild
            variant="outline"
            className="w-full h-11 font-semibold"
          >
            <Link href={`/${slug}/admin`}>
              Kembali ke Dasbor <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>

        </CardContent>
      </Card>
    </div>
  );
}
