'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import {
  getAllSettings,
  updatePointsConversionRate,
  updateMinPointsForRedemption,
  updateMaxPointsPerTransaction,
  initializeSettings,
} from '@/actions/settings';
import { Coins, Save, RefreshCw, Info, ArrowRightLeft, ShieldAlert } from 'lucide-react';

export default function PointsSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [conversionRate, setConversionRate] = useState('1000');
  const [minPoints, setMinPoints] = useState('10');
  const [maxPoints, setMaxPoints] = useState('1000');

  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const settings = await getAllSettings();
      setConversionRate(settings.pointsConversionRate);
      setMinPoints(settings.minPointsForRedemption);
      setMaxPoints(settings.maxPointsPerTransaction);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async function handleSaveConversionRate() {
    setLoading(true);
    try {
      const rate = parseInt(conversionRate);
      if (isNaN(rate) || rate < 100 || rate > 10000) {
        toast({ title: 'Nilai tidak valid', description: 'Nilai tukar harus antara 100 dan 10.000', variant: 'destructive' });
        return;
      }
      await updatePointsConversionRate(rate);
      toast({ title: 'Berhasil disimpan', description: `1 poin = Rp ${rate.toLocaleString('id-ID')}` });
    } catch (error: any) {
      toast({ title: 'Gagal', description: error.message || 'Gagal menyimpan nilai tukar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveMinPoints() {
    setLoading(true);
    try {
      const min = parseInt(minPoints);
      if (isNaN(min) || min < 1 || min > 1000) {
        toast({ title: 'Nilai tidak valid', description: 'Minimal poin harus antara 1 dan 1.000', variant: 'destructive' });
        return;
      }
      await updateMinPointsForRedemption(min);
      toast({ title: 'Berhasil disimpan', description: `Minimal penukaran: ${min} poin` });
    } catch (error: any) {
      toast({ title: 'Gagal', description: error.message || 'Gagal menyimpan minimal poin', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveMaxPoints() {
    setLoading(true);
    try {
      const max = parseInt(maxPoints);
      if (isNaN(max) || max < 10) {
        toast({ title: 'Nilai tidak valid', description: 'Maksimal poin harus minimal 10', variant: 'destructive' });
        return;
      }
      await updateMaxPointsPerTransaction(max);
      toast({ title: 'Berhasil disimpan', description: `Maksimal penukaran: ${max} poin per transaksi` });
    } catch (error: any) {
      toast({ title: 'Gagal', description: error.message || 'Gagal menyimpan maksimal poin', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleInitialize() {
    setInitializing(true);
    try {
      await initializeSettings();
      await loadSettings();
      toast({ title: 'Berhasil', description: 'Pengaturan direset ke nilai default' });
    } catch (error: any) {
      toast({ title: 'Gagal', description: error.message || 'Gagal mereset pengaturan', variant: 'destructive' });
    } finally {
      setInitializing(false);
    }
  }

  const redeemable = Math.min(100, parseInt(maxPoints) || 0);
  const maxDiscount = redeemable * (parseInt(conversionRate) || 0);

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="w-5 h-5 text-[#028697]" />
            Pengaturan Poin
          </CardTitle>
          <CardDescription>Atur aturan penukaran poin untuk member</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Conversion Rate */}
          <div className="space-y-2">
            <Label htmlFor="conversionRate" className="text-sm font-medium">Nilai Tukar Poin</Label>
            <p className="text-xs text-gray-500">Jumlah rupiah yang didapat dari 1 poin</p>
            <div className="flex gap-2 items-center">
              <span className="text-sm text-gray-500 shrink-0">1 poin =  Rp</span>
              <Input
                id="conversionRate"
                type="number"
                min="100"
                max="10000"
                step="100"
                value={conversionRate}
                onChange={(e) => setConversionRate(e.target.value)}
                placeholder="1000"
                className="max-w-[140px]"
              />
              <Button size="sm" onClick={handleSaveConversionRate} disabled={loading} className="bg-[#028697] hover:bg-[#17a8bb]">
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Simpan
              </Button>
            </div>
          </div>

          <Separator />

          {/* Min Points */}
          <div className="space-y-2">
            <Label htmlFor="minPoints" className="text-sm font-medium">Minimal Penukaran</Label>
            <p className="text-xs text-gray-500">Jumlah poin terkecil yang bisa ditukarkan</p>
            <div className="flex gap-2 items-center">
              <Input
                id="minPoints"
                type="number"
                min="1"
                max="1000"
                value={minPoints}
                onChange={(e) => setMinPoints(e.target.value)}
                placeholder="10"
                className="max-w-[140px]"
              />
              <span className="text-sm text-gray-500">poin</span>
              <Button size="sm" onClick={handleSaveMinPoints} disabled={loading} className="bg-[#028697] hover:bg-[#17a8bb]">
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Simpan
              </Button>
            </div>
          </div>

          <Separator />

          {/* Max Points */}
          <div className="space-y-2">
            <Label htmlFor="maxPoints" className="text-sm font-medium">Maksimal Penukaran per Transaksi</Label>
            <p className="text-xs text-gray-500">Batas poin yang bisa ditukarkan dalam satu transaksi</p>
            <div className="flex gap-2 items-center">
              <Input
                id="maxPoints"
                type="number"
                min="10"
                value={maxPoints}
                onChange={(e) => setMaxPoints(e.target.value)}
                placeholder="1000"
                className="max-w-[140px]"
              />
              <span className="text-sm text-gray-500">poin</span>
              <Button size="sm" onClick={handleSaveMaxPoints} disabled={loading} className="bg-[#028697] hover:bg-[#17a8bb]">
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Simpan
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Simulasi */}
      <Card className="bg-gradient-to-br from-[#e0f9fc] to-[#f0fdfe] border-[#1ecbe1]/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="w-5 h-5 text-[#028697]" />
            Simulasi Penukaran
          </CardTitle>
          <CardDescription>Contoh untuk member dengan 100 poin</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
              <p className="text-xs text-gray-500 mb-1">Poin Dimiliki</p>
              <p className="text-2xl font-bold text-gray-800">100</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
              <p className="text-xs text-gray-500 mb-1">Bisa Ditukar</p>
              <p className="text-2xl font-bold text-[#028697]">{redeemable}</p>
              <p className="text-xs text-gray-400">poin</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
              <p className="text-xs text-gray-500 mb-1">Maks. Diskon</p>
              <p className="text-lg font-bold text-emerald-600">
                Rp {maxDiscount.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 mt-4 text-xs text-[#028697]/80">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Batas penukaran dibatasi oleh <strong>maksimal {maxPoints} poin</strong> per transaksi.
              Sisa poin dapat digunakan di transaksi berikutnya.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Reset */}
      <Card className="border-orange-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-orange-700">
            <ShieldAlert className="w-5 h-5" />
            Reset ke Default
          </CardTitle>
          <CardDescription>
            Kembalikan semua pengaturan poin ke nilai bawaan sistem
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={handleInitialize}
            disabled={initializing}
            className="border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${initializing ? 'animate-spin' : ''}`} />
            {initializing ? 'Mereset...' : 'Reset Pengaturan'}
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}