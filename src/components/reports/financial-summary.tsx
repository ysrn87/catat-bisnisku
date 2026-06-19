'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, Info } from 'lucide-react';

interface FinancialSummaryProps {
  data: {
    totalIncome: number;
    totalExpenses: number;
    totalSalesRevenue: number;
    netProfit: number;
  };
}

export function FinancialSummary({ data }: FinancialSummaryProps) {
  const profitMargin = data.totalSalesRevenue > 0
    ? ((data.netProfit / data.totalSalesRevenue) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pemasukan</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-green-600">{formatCurrency(data.totalIncome)}</div>
            <p className="text-xs text-muted-foreground mt-1">Dari catatan arus kas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pengeluaran</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-red-600">{formatCurrency(data.totalExpenses)}</div>
            <p className="text-xs text-muted-foreground mt-1">Dari catatan arus kas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendapatan Penjualan</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-blue-600">{formatCurrency(data.totalSalesRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Dari seluruh transaksi POS</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Laba Bersih</CardTitle>
            <PiggyBank className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl md:text-3xl font-bold ${data.netProfit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
              {formatCurrency(data.netProfit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Margin: {profitMargin}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Ringkasan Keuangan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ringkasan Keuangan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
              <span className="text-sm font-medium">Total Pemasukan</span>
            </div>
            <span className="text-sm font-bold text-green-600">{formatCurrency(data.totalIncome)}</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
              <span className="text-sm font-medium">Total Pengeluaran</span>
            </div>
            <span className="text-sm font-bold text-red-600">−{formatCurrency(data.totalExpenses)}</span>
          </div>

          <div className="flex items-center justify-between py-3 px-3 rounded-xl bg-gray-50 border border-gray-100">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${data.netProfit >= 0 ? 'bg-purple-500' : 'bg-red-500'}`} />
              <span className="text-sm font-bold">{data.netProfit >= 0 ? 'Laba Bersih' : 'Rugi Bersih'}</span>
            </div>
            <span className={`text-base font-bold ${data.netProfit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
              {formatCurrency(data.netProfit)}
            </span>
          </div>

          {/* Note about data sources */}
          <div className="flex items-start gap-2 pt-1">
            <Info className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Pemasukan dan pengeluaran diambil dari catatan arus kas manual. Pendapatan penjualan diambil dari transaksi POS.
              Jika penjualan juga dicatat di arus kas sebagai pemasukan, angka tersebut bisa tercatat dua kali.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
