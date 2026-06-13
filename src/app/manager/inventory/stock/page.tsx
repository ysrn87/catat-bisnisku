import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, AlertTriangle } from 'lucide-react';
import { StockTable } from '@/components/stock/stock-table';
import { StockMovementsTable } from '@/components/stock/stock-movements-table';
import { SearchFilterBar } from '@/components/filters/search-filter-bar';

async function getStockMovements(params: {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  sort?: string;
}) {
  const { 
    page = 1, 
    limit = 10, 
    search = '', 
    type = 'all',
    sort = 'date_desc'
  } = params;
  
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = {};
  
  // Search by product or variant name
  if (search) {
    where.OR = [
      { 
        variant: { 
          name: { contains: search, mode: 'insensitive' as const } 
        } 
      },
      { 
        variant: { 
          product: { 
            name: { contains: search, mode: 'insensitive' as const } 
          } 
        } 
      },
      {
        notes: { contains: search, mode: 'insensitive' as const }
      }
    ];
  }

  // Filter by movement type
  if (type !== 'all') {
    where.type = type;
  }

  // Build orderBy clause
  const orderBy: any = [];
  switch (sort) {
    case 'date_asc':
      orderBy.push({ createdAt: 'asc' });
      break;
    case 'date_desc':
      orderBy.push({ createdAt: 'desc' });
      break;
    default:
      orderBy.push({ createdAt: 'desc' });
  }
  
  const [movements, total] = await Promise.all([
    db.stockMovement.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        variant: {
          include: {
            product: true,
          },
        },
      },
    }),
    db.stockMovement.count({ where }),
  ]);

  // Serialize to match StockMovementsTable expected type
  const serializedMovements = movements.map((movement: typeof movements[number]) => ({
    id: movement.id,
    type: movement.type,
    quantity: movement.quantity,
    notes: movement.notes,
    createdAt: movement.createdAt,
    variant: {
      name: movement.variant.name,
      product: {
        name: movement.variant.product.name,
      },
    },
  }));

  return { movements: serializedMovements, total };
}

async function getStockData() {
  const [totalVariants, lowStockCount, stockValue] = await Promise.all([
    db.productVariant.count(),
    db.productVariant.count({
      where: {
        stock: {
          lte: db.productVariant.fields.lowStock,
        },
      },
    }),
    db.productVariant.aggregate({
      _sum: {
        stock: true,
      },
    }),
  ]);

  return {
    totalVariants,
    lowStockCount,
    totalStock: stockValue._sum.stock || 0,
  };
}

async function getAllStock(params: {
  page?: number;
  limit?: number;
  search?: string;
  stockLevel?: string;
  sort?: string;
}) {
  const { 
    page = 1, 
    limit = 10, 
    search = '', 
    stockLevel = 'all',
    sort = 'stock_asc'
  } = params;
  
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = {};
  
  // Search by variant name, product name, or SKU
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' as const } },
      { sku: { contains: search, mode: 'insensitive' as const } },
      { 
        product: { 
          name: { contains: search, mode: 'insensitive' as const } 
        } 
      },
    ];
  }

  // Filter by stock level
  if (stockLevel !== 'all') {
    switch (stockLevel) {
      case 'low':
        // Stock is less than or equal to lowStock threshold
        where.stock = { lte: db.productVariant.fields.lowStock };
        break;
      case 'normal':
        // Stock is greater than lowStock threshold
        where.stock = { gt: db.productVariant.fields.lowStock };
        break;
      case 'out':
        // Stock is exactly 0
        where.stock = { equals: 0 };
        break;
    }
  }

  // Build orderBy clause
  const orderBy: any = [];
  switch (sort) {
    case 'stock_asc':
      orderBy.push({ stock: 'asc' });
      break;
    case 'stock_desc':
      orderBy.push({ stock: 'desc' });
      break;
    case 'name_asc':
      orderBy.push({ product: { name: 'asc' } });
      break;
    case 'name_desc':
      orderBy.push({ product: { name: 'desc' } });
      break;
    default:
      orderBy.push({ stock: 'asc' });
  }
  
  const [items, total] = await Promise.all([
    db.productVariant.findMany({
      where,
      skip,
      take: limit,
      include: {
        product: true,
      },
      orderBy,
    }),
    db.productVariant.count({ where }),
  ]);

  // Convert Decimal to Number for client component
  const serializedItems = items.map((item: typeof items[number]) => ({
    ...item,
    price: Number(item.price),
    cost: Number(item.cost),
  }));

  return { items: serializedItems, total };
}

export default async function AdminStockPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    // Stock items params
    page?: string; 
    limit?: string;
    search?: string;
    stockLevel?: string;
    sort?: string;
    // Stock movements params
    movementPage?: string;
    movementLimit?: string;
    movementSearch?: string;
    movementType?: string;
    movementSort?: string;
  }>;
}) {
  const params = await searchParams;
  
  // Stock items params
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || 10;
  const search = params.search || '';
  const stockLevel = params.stockLevel || 'all';
  const sort = params.sort || 'stock_asc';

  // Stock movements params
  const movementPage = Number(params.movementPage) || 1;
  const movementLimit = Number(params.movementLimit) || 10;
  const movementSearch = params.movementSearch || '';
  const movementType = params.movementType || 'all';
  const movementSort = params.movementSort || 'date_desc';

  const stats = await getStockData();
  const { items: stockItems, total } = await getAllStock({ page, limit, search, stockLevel, sort });
  const { movements, total: movementsTotal } = await getStockMovements({ 
    page: movementPage, 
    limit: movementLimit,
    search: movementSearch,
    type: movementType,
    sort: movementSort
  });

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex justify-between items-center">
      </div>
      {/* Stats Cards */}
      <div className="grid gap-3 md:gap-4 grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Produk</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{stats.totalVariants}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">Varian produk</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Stok Kurang</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-red-600">{stats.lowStockCount}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">Butuh penambahan</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Stok</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{stats.totalStock}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">Total unit</p>
          </CardContent>
        </Card>
      </div>

      {/* Stock Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Ketersediaan Item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search & Filter Bar for Stock Items */}
          <SearchFilterBar
            searchPlaceholder="Search by product or variant name..."
            filters={[
              {
                key: 'stockLevel',
                label: 'Stock Level',
                defaultValue: 'all',
                options: [
                  { value: 'all', label: 'All Items' },
                  { value: 'low', label: 'Low Stock' },
                  { value: 'normal', label: 'Normal Stock' },
                  { value: 'out', label: 'Out of Stock' },
                ],
              },
            ]}
            sortOptions={[
              { value: 'stock_asc', label: 'Lowest Stock' },
              { value: 'stock_desc', label: 'Highest Stock' },
              { value: 'name_asc', label: 'Name (A-Z)' },
              { value: 'name_desc', label: 'Name (Z-A)' },
            ]}
            defaultSort="stock_asc"
          />

          {/* Stock Table */}
          <StockTable 
            stockItems={stockItems}
            currentPage={page}
            pageSize={limit}
            totalItems={total}
          />
        </CardContent>
      </Card>

      {/* Recent Stock Movements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Riwayat Sirkulasi Barang</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search & Filter Bar for Stock Movements */}
          <SearchFilterBar
            searchPlaceholder="Search stock movements..."
            filters={[
              {
                key: 'movementType',
                label: 'Movement Type',
                defaultValue: 'all',
                options: [
                  { value: 'all', label: 'All Types' },
                  { value: 'IN', label: 'Stock In' },
                  { value: 'OUT', label: 'Stock Out' },
                  { value: 'ADJUSTMENT', label: 'Adjustment' },
                ],
              },
            ]}
            sortOptions={[
              { value: 'date_desc', label: 'Newest First' },
              { value: 'date_asc', label: 'Oldest First' },
            ]}
            defaultSort="date_desc"
          />

          {/* Stock Movements Table */}
          <StockMovementsTable 
            movements={movements}
            currentPage={movementPage}
            pageSize={movementLimit}
            totalItems={movementsTotal}
          />
        </CardContent>
      </Card>
    </div>
  );
}