'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { ProductDialog } from '@/components/products/product-dialog';
import { VariantDialog } from '@/components/products/variant-dialog';
import { ProductDeleteButton, VariantDeleteButton } from '@/components/products/delete-buttons';
import { ActiveToggle } from '@/components/products/active-toggle';
import { ChevronDown, ChevronUp, Package } from 'lucide-react';

interface Variant {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  price: number;
  cost: number;
  stock: number;
  lowStock: number;
  isActive: boolean;
  points: number;
}

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description: string | null;
    sku: string;
    isActive: boolean;
    type: string;
    variants: Variant[];
  };
  filterStatus: string;
}

export function ProductCard({ product, filterStatus }: ProductCardProps) {
  const [variantsOpen, setVariantsOpen] = useState(true);
  const isPreorder = product.type === 'PREORDER';

  const activeCount = product.variants.filter((v) => v.isActive).length;
  const totalCount = product.variants.length;

  return (
    <Card className={!product.isActive ? 'opacity-60' : ''}>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
          {/* Product info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm sm:text-md font-bold leading-tight">{product.name}</span>
                {isPreorder && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                    Pre-Order
                  </span>
                )}
                {!product.isActive && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                    Nonaktif
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-sm text-muted-foreground mt-1">
                SKU: {product.sku} •{' '}
                <button
                  onClick={() => setVariantsOpen((v) => !v)}
                  className="hover:text-[#00a090] transition-colors"
                >
                  {totalCount} varian
                  {totalCount > 0 && (
                    <span className="ml-1 text-[10px] sm:text-xs text-gray-400">
                      ({activeCount} aktif)
                    </span>
                  )}
                </button>
              </p>
              {product.description && (
                <p className="text-[10px] sm:text-xs md:text-sm text-gray-600 mt-1">{product.description}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Active toggle */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-sm text-muted-foreground hidden sm:inline">
                {product.isActive ? 'Aktif' : 'Nonaktif'}
              </span>
              <ActiveToggle id={product.id} isActive={product.isActive} type="product" />
            </div>

            <ProductDialog
              mode="edit"
              product={{
                id: product.id,
                name: product.name,
                description: product.description,
                sku: product.sku,
                type: product.type,
              }}
            />
            <ProductDeleteButton productId={product.id} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Variants section header */}
        {totalCount > 0 && (
          <div className="flex justify-between items-center mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setVariantsOpen((v) => !v)}
              className="text-[12px] sm:text-xs font-medium text-gray-700 hover:text-[#00a090] hover:bg-transparent px-0 gap-1.5"
            >
              {variantsOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Varian
            </Button>
            <VariantDialog mode="create" productId={product.id} productSku={product.sku} variantCount={product.variants.length} isPreorder={isPreorder} />
          </div>
        )}

        {/* Collapsed pill summary */}
        {!variantsOpen && totalCount > 0 && (
          <div className="flex flex-wrap gap-2 pb-1">
            {product.variants.map((v) => (
              <span
                key={v.id}
                onClick={() => setVariantsOpen(true)}
                className={`cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors
                  ${v.isActive
                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}
              >
                {v.name}
                <span className="text-[10px] opacity-70">
                  {v.isActive ? '●' : '○'}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Variants expanded */}
        {variantsOpen && (
          <>
            {totalCount === 0 ? (
              <div className="text-center py-8">
                <Package className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                <p className="text-muted-foreground mb-4 text-sm">
                  {filterStatus === 'all'
                    ? 'Belum ada varian tersedia'
                    : `No ${filterStatus} variants found`}
                </p>
                <VariantDialog mode="create" productId={product.id} productSku={product.sku} variantCount={product.variants.length} isPreorder={isPreorder} />
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block rounded-md border border-gray-100 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/80">
                        <TableHead>SKU</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Harga</TableHead>
                        {!isPreorder && <TableHead>Stok</TableHead>}
                        <TableHead>Aktif</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-sm">
                      {product.variants.map((variant) => (
                        <TableRow
                          key={variant.id}
                          className={!variant.isActive ? 'opacity-50 bg-gray-50/50' : ''}
                        >
                          <TableCell className="text-gray-500">{variant.sku}</TableCell>
                          <TableCell className="font-medium">{variant.name}</TableCell>
                          <TableCell>{formatCurrency(variant.price)}</TableCell>
                          {!isPreorder && (
                            <TableCell>
                              <span
                                className={
                                  variant.stock <= variant.lowStock
                                    ? 'text-red-600 font-semibold'
                                    : ''
                                }
                              >
                                {variant.stock}
                                {variant.stock <= variant.lowStock && (
                                  <span className="ml-1 text-[10px] text-red-500">⚠</span>
                                )}
                              </span>
                            </TableCell>
                          )}
                          <TableCell>
                            <ActiveToggle
                              id={variant.id}
                              isActive={variant.isActive}
                              type="variant"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <VariantDialog
                                mode="edit"
                                isPreorder={isPreorder}
                                variant={{
                                  id: variant.id,
                                  name: variant.name,
                                  sku: variant.sku,
                                  barcode: variant.barcode,
                                  price: variant.price,
                                  cost: variant.cost,
                                  stock: variant.stock,
                                  lowStock: variant.lowStock,
                                  points: variant.points,
                                }}
                              />
                              <VariantDeleteButton variantId={variant.id} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-2">
                  {product.variants.map((variant) => (
                    <div
                      key={variant.id}
                      className={`rounded-lg p-3 border transition-colors ${
                        variant.isActive
                          ? 'bg-gray-50 border-gray-200'
                          : 'bg-gray-50/40 border-gray-100 opacity-60'
                      }`}
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-xs font-bold text-gray-900 truncate">{variant.name}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">SKU: {variant.sku}</p>
                        </div>
                        {/* Active switch */}
                        <ActiveToggle
                          id={variant.id}
                          isActive={variant.isActive}
                          type="variant"
                        />
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-2 gap-2 mb-1">
                        <div>
                          <p className="text-[10px] text-gray-500">Harga</p>
                          <p className="text-[12px] font-semibold text-[#00a090]">
                            {formatCurrency(variant.price)}
                          </p>
                        </div>
                        {!isPreorder && (
                          <div>
                            <p className="text-[10px] text-gray-500">Stok</p>
                            <p
                              className={`text-[12px] font-semibold ${
                                variant.stock <= variant.lowStock
                                  ? 'text-red-600'
                                  : 'text-gray-900'
                              }`}
                            >
                              {variant.stock} unit
                              {variant.stock <= variant.lowStock && (
                                <span className="ml-1 text-[10px]">⚠</span>
                              )}
                            </p>
                          </div>
                        )}
                        {isPreorder && (
                          <div>
                            <p className="text-[10px] text-gray-500">Tipe</p>
                            <p className="text-[12px] font-semibold text-amber-600">Pre Order</p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 pt-1 border-t border-gray-200">
                        <VariantDialog
                          mode="edit"
                          isPreorder={isPreorder}
                          variant={{
                            id: variant.id,
                            name: variant.name,
                            sku: variant.sku,
                            barcode: variant.barcode,
                            price: variant.price,
                            cost: variant.cost,
                            stock: variant.stock,
                            lowStock: variant.lowStock,
                            points: variant.points,
                          }}
                        />
                        <VariantDeleteButton variantId={variant.id} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}