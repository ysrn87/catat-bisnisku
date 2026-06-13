import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import { FileText, Package } from 'lucide-react';
import { InventoryReportTable } from '@/components/reports/inventory-report-table';

async function getSalesReport() {
  const sales = await db.sale.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      customer: {
        select: { name: true, email: true },
      },
      items: {
        include: {
          variant: {
            include: {
              product: true,
            },
          },
        },
      },
    },
  });

  const totalSales = await db.sale.aggregate({
    _sum: { total: true },
    _count: true,
  });

  // Convert ALL Decimal fields to numbers
  const serializedSales = sales.map((sale: typeof sales[number]) => ({
    ...sale,
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount),
    tax: Number(sale.tax),
    total: Number(sale.total),
    items: sale.items.map((item: typeof sale.items[number]) => ({
      ...item,
      price: Number(item.price),
      subtotal: Number(item.subtotal),
      variant: {
        ...item.variant,
        price: Number(item.variant.price),
        cost: Number(item.variant.cost),
      },
    })),
  }));

  return {
    sales: serializedSales,
    totalRevenue: Number(totalSales._sum.total) || 0,
    totalTransactions: totalSales._count,
  };
}

async function getInventoryReport(page: number = 1, limit: number = 10) {
  const skip = (page - 1) * limit;

  const [inventory, totalProducts, lowStockCount] = await Promise.all([
    db.productVariant.findMany({
      skip,
      take: limit,
      include: {
        product: true,
      },
      orderBy: {
        stock: 'asc',
      },
    }),
    db.productVariant.count(),
    db.productVariant.count({
      where: {
        stock: {
          lte: db.productVariant.fields.lowStock,
        },
      },
    }),
  ]);

  // Convert ALL Decimal fields to numbers
  const serializedInventory = inventory.map((item: typeof inventory[number]) => ({
    ...item,
    price: Number(item.price),
    cost: Number(item.cost),
  }));

  const inventoryValue = serializedInventory.reduce((sum: number, item: typeof serializedInventory[number]) => {
    return sum + (item.cost * item.stock);
  }, 0);

  const inventoryPrice = serializedInventory.reduce((sum: number, item: typeof serializedInventory[number]) => {
    return sum + (item.price * item.stock);
  }, 0)

  return {
    inventory: serializedInventory,
    totalProducts,
    lowStockCount,
    inventoryValue,
    inventoryPrice,
  };
}

async function getFinancialReport() {
  const [income, expenses, sales] = await Promise.all([
    db.cashflow.aggregate({
      _sum: { amount: true },
      where: { type: 'INCOME' },
    }),
    db.cashflow.aggregate({
      _sum: { amount: true },
      where: { type: 'EXPENSE' },
    }),
    db.sale.aggregate({
      _sum: { total: true },
    }),
  ]);

  const totalIncome = Number(income._sum.amount) || 0;
  const totalExpenses = Number(expenses._sum.amount) || 0;
  const totalSalesRevenue = Number(sales._sum.total) || 0;
  const netProfit = totalIncome - totalExpenses;

  return {
    totalIncome,
    totalExpenses,
    totalSalesRevenue,
    netProfit,
  };
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || 10;

  const [salesData, inventoryData, financialData] = await Promise.all([
    getSalesReport(),
    getInventoryReport(page, limit),
    getFinancialReport(),
  ]);

  return (
    <div className="space-y-8">

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(inventoryData.inventoryValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {inventoryData.totalProducts} produk
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Stock Price</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(inventoryData.inventoryPrice)}
            </div>
            <p className="text-xs text-muted-foreground">
              {inventoryData.totalProducts} produk
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stok Menipis</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {inventoryData.lowStockCount}
            </div>
            <p className="text-xs text-muted-foreground">Butuh penambahan</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Reports */}
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium">Inventory Status</CardTitle>
            </CardHeader>
            <CardContent>
              <InventoryReportTable 
                inventory={inventoryData.inventory} 
                currentPage={page}
                pageSize={limit}
                totalItems={inventoryData.totalProducts}
              />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}