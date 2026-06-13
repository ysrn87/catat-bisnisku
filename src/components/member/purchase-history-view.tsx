'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pagination } from '@/components/ui/pagination';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Gift, LayoutGrid, TableIcon } from 'lucide-react';

interface PurchaseItem {
  id: string;
  quantity: number;
  price: number;
  subtotal: number;
  variant: {
    name: string;
    product: {
      name: string;
    };
  };
}

interface Purchase {
  id: string;
  saleNumber: string;
  createdAt: Date;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  notes: string | null;
  pointsEarned: number;
  pointsRedeemed: number | null;
  items: PurchaseItem[];
}

interface PurchaseHistoryViewProps {
  purchases: Purchase[];
  conversionRate: number;
}

export function PurchaseHistoryView({ purchases, conversionRate }: PurchaseHistoryViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  // Calculate pagination
  const totalPages = Math.ceil(purchases.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedPurchases = purchases.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  if (purchases.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Belum ada pembelian</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'card' | 'table')}>
        <TabsList>
          <TabsTrigger value="card" className="gap-2">
            <LayoutGrid className="w-4 h-4" />
            Tampilan Kartu
          </TabsTrigger>
          <TabsTrigger value="table" className="gap-2">
            <TableIcon className="w-4 h-4" />
            Tampilan Tabel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="card" className="space-y-6">
          {paginatedPurchases.map((purchase) => {
            const pointsRedeemed = purchase.pointsRedeemed || 0;
            const pointDiscount = pointsRedeemed * conversionRate;
            
            return (
              <Card key={purchase.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex gap-2 mb-2">
                        {purchase.pointsEarned > 0 && (
                          <p className="inline-flex items-center px-2 py-1 rounded-full text-sm 
                         font-medium bg-blue-100 text-blue-800">
                            +{purchase.pointsEarned} poin
                          </p>
                        )}
                        {pointsRedeemed > 0 && (
                          <p className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm 
                         font-medium bg-purple-100 text-purple-800">
                            <Gift className="w-4 h-4" />
                            -{pointsRedeemed} poin ditukar
                          </p>
                        )}
                      </div>
                      <CardTitle className="text-lg">Order {purchase.saleNumber}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDateTime(purchase.createdAt)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Variant</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchase.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.variant.product.name}
                          </TableCell>
                          <TableCell>{item.variant.name}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(item.price))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(item.subtotal))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(Number(purchase.subtotal))}</span>
                    </div>
                    {Number(purchase.discount) > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount:</span>
                        <span>-{formatCurrency(Number(purchase.discount))}</span>
                      </div>
                    )}
                    {pointsRedeemed > 0 && (
                      <div className="flex justify-between text-purple-600 font-medium">
                        <span>Discount ({pointsRedeemed} poin):</span>
                        <span>-{formatCurrency(pointDiscount)}</span>
                      </div>
                    )}
                    {Number(purchase.tax) > 0 && (
                      <div className="flex justify-between">
                        <span>Tax:</span>
                        <span>{formatCurrency(Number(purchase.tax))}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg pt-2 border-t">
                      <span>Total:</span>
                      <span>{formatCurrency(Number(purchase.total))}</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Metode Bayar: <span className="font-medium">{purchase.paymentMethod}</span>
                    </p>
                    {purchase.notes && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Notes: {purchase.notes}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="table">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Order</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">Diskon</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Pembayaran</TableHead>
                    <TableHead className="text-center">Poin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPurchases.map((purchase) => {
                    const pointsRedeemed = purchase.pointsRedeemed || 0;
                    const totalDiscount = Number(purchase.discount) + (pointsRedeemed * conversionRate);
                    const itemCount = purchase.items.reduce((sum, item) => sum + item.quantity, 0);
                    
                    return (
                      <TableRow key={purchase.id}>
                        <TableCell className="font-medium">{purchase.saleNumber}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(purchase.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {purchase.items.length === 1 ? (
                              <span>{purchase.items[0].variant.product.name}</span>
                            ) : (
                              <span>{itemCount} item</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(purchase.subtotal))}
                        </TableCell>
                        <TableCell className="text-right">
                          {totalDiscount > 0 ? (
                            <span className="text-green-600">
                              -{formatCurrency(totalDiscount)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(purchase.total))}
                        </TableCell>
                        <TableCell>{purchase.paymentMethod}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col gap-1">
                            {purchase.pointsEarned > 0 && (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs 
                                font-medium bg-blue-100 text-blue-800">
                                +{purchase.pointsEarned}
                              </span>
                            )}
                            {pointsRedeemed > 0 && (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs 
                                font-medium bg-purple-100 text-purple-800">
                                -{pointsRedeemed}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={purchases.length}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  );
}