'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign, PiggyBank } from 'lucide-react';

interface FinancialSummaryProps {
  data: {
    totalIncome: any;
    totalExpenses: any;
    totalSalesRevenue: any;
    netProfit: number;
  };
}

export function FinancialSummary({ data }: FinancialSummaryProps) {
  const profitMargin = Number(data.totalSalesRevenue) > 0 
    ? ((data.netProfit / Number(data.totalSalesRevenue)) * 100).toFixed(2)
    : '0.00';

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pemasukan</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(Number(data.totalIncome))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Dari catatan arus kas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pengeluaran</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {formatCurrency(Number(data.totalExpenses))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Dari catatan arus kas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendapatan Penjualan</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {formatCurrency(Number(data.totalSalesRevenue))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Dari seluruh transaksi penjualan
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Laba Bersih</CardTitle>
            <PiggyBank className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${data.netProfit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
              {formatCurrency(data.netProfit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Profit margin: {profitMargin}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="font-medium">Total Pemasukan</span>
              </div>
              <span className="text-lg font-bold text-green-600">
                {formatCurrency(Number(data.totalIncome))}
              </span>
            </div>

            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="font-medium">Total Pengeluaran</span>
              </div>
              <span className="text-lg font-bold text-red-600">
                -{formatCurrency(Number(data.totalExpenses))}
              </span>
            </div>

            <div className="flex items-center justify-between pb-3 border-b bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${data.netProfit >= 0 ? 'bg-purple-500' : 'bg-red-500'}`}></div>
                <span className="font-bold">Laba/Rugi</span>
              </div>
              <span className={`text-xl font-bold ${data.netProfit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                {formatCurrency(data.netProfit)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}