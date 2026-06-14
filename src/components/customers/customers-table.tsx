'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { Award } from 'lucide-react';
import { CustomerDetailsDialog } from './customer-details-dialog';
import { PointsHistoryDialog } from './points-history-dialog';
import { Pagination } from '@/components/ui/pagination';

interface MemberCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  birthday?: Date | null;
  address?: string | null;
  photoUrl?: string | null;
  points: number;
  createdAt: Date;
  sales: Array<{
    id: string;
    total: any;
  }>;
  _count: {
    sales: number;
  };
  type: 'member';
}

interface NonMemberCustomer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  createdAt: Date;
  sales: Array<{
    id: string;
    total: any;
  }>;
  _count: {
    sales: number;
  };
  type: 'non-member';
}

type Customer = MemberCustomer | NonMemberCustomer;

interface CustomersTableProps {
  customers: Customer[];
  showActions?: boolean;
  currentPage: number;
  pageSize: number;
  totalItems: number;
}

export function CustomersTable({ 
  customers, 
  showActions = false,
  currentPage,
  pageSize,
  totalItems
}: CustomersTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pointsHistoryCustomer, setPointsHistoryCustomer] = useState<MemberCustomer | null>(null);
  const [pointsHistoryOpen, setPointsHistoryOpen] = useState(false);

  const totalPages = Math.ceil(totalItems / pageSize);

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    router.push(`?${params.toString()}`);
  };

  const handlePageSizeChange = (size: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('limit', size.toString());
    params.set('page', '1');
    router.push(`?${params.toString()}`);
  };

  const handleViewDetails = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDetailsOpen(true);
  };

  const handleViewPoints = (customer: MemberCustomer) => {
    setPointsHistoryCustomer(customer);
    setPointsHistoryOpen(true);
  };

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader className="text-center">
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Telpon/WA</TableHead>
              <TableHead>Tanggal Lahir</TableHead>
              <TableHead>Alamat</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Poin</TableHead>
              <TableHead>Total Pembelian</TableHead>
              <TableHead>Total Belanja</TableHead>
              <TableHead>Terdaftar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className='text-sm'>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  Tidak ditemukan pelanggan
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => {
                const totalSpent = customer.sales.reduce((sum, sale) => sum + Number(sale.total), 0);
                const isMember = customer.type === 'member';

                return (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer hover:bg-muted/60"
                    onClick={() => handleViewDetails(customer)}
                  >
                    <TableCell className="font-medium">
                      <p className='truncate'>
                        {customer.name}
                      </p>  
                    </TableCell>
                    <TableCell className='truncate'>
                      {isMember ? (
                        <Badge variant="default" className="bg-blue-600">Member</Badge>
                      ) : (
                        <Badge variant="secondary">Non-Member</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.phone || '-'}
                    </TableCell>
                    <TableCell>
                      <p className='line-clamp-2 min-w-32'>
                        {isMember && customer.birthday 
                        ? new Date(customer.birthday).toLocaleDateString('id-ID', { 
                            day: '2-digit', 
                            month: 'long', 
                            year: 'numeric' 
                          }) 
                        : '-'}
                      </p>                      
                    </TableCell>
                    <TableCell title={customer.address || '-'}>
                      <p className='line-clamp-2'>
                        {customer.address || '-'}
                      </p>  
                    </TableCell>
                    <TableCell>{isMember && customer.email ? customer.email : '-'}</TableCell>
                    <TableCell>
                      {isMember ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleViewPoints(customer as MemberCustomer); }}
                          className="flex items-center gap-1 hover:text-yellow-700 transition-colors cursor-pointer group"
                          title="Lihat riwayat poin"
                        >
                          <Award className="h-4 w-4 text-yellow-600 group-hover:scale-110 transition-transform" />
                          <span className="font-semibold underline decoration-dotted underline-offset-2">
                            {customer.points}
                          </span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{customer._count.sales}</TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(totalSpent)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-2">
        {customers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Tidak ditemukan pelanggan</p>
          </div>
        ) : (
          customers.map((customer) => {
            const totalSpent = customer.sales.reduce((sum, sale) => sum + Number(sale.total), 0);
            const isMember = customer.type === 'member';

            return (
              <div
                key={customer.id}
                onClick={() => handleViewDetails(customer)}
                className="bg-white border border-gray-200 rounded-xl p-4 active:bg-gray-50 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{customer.name}</p>
                    <p className="text-[11px] font-semibold text-gray-500 mt-0.5">{customer.phone}</p>
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    {isMember ? (
                      <Badge variant="default" className="bg-blue-600 text-[11px]">Member</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[11px]">Non-Member</Badge>
                    )}
                  </div>
                </div>

                {/* Points (if member) */}
                {isMember && (
                  <div 
                    className="mb-2 pb-2 border-gray-100"
                    onClick={(e) => { e.stopPropagation(); handleViewPoints(customer as MemberCustomer); }}
                  >
                    <div className="flex items-center gap-2">
                      <Award className="h-3 w-3 text-yellow-600" />
                      <span className="text-[10px] text-gray-500">Points:</span>
                      <span className="text-xs font-bold text-yellow-700">{customer.points}</span>
                    </div>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <p className="text-[10px] text-gray-500">Total Belanja</p>
                    <p className="text-xs font-bold text-[#00a090]">{formatCurrency(totalSpent)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 text-right pr-3">Transaksi</p>
                    <p className="text-xs font-semibold text-gray-900 text-right pr-3">{customer._count.sales}x</p>
                  </div>
                </div>

                {/* Additional Info */}
                {customer.address && (
                  <div className="pt-2 border-t border-gray-100 pr-1">
                    <p className="text-[10px] text-gray-500 mb-0">Alamat:</p>
                    <p className="text-[10px] text-gray-700 line-clamp-2">{customer.address}</p>
                  </div>
                )}

                {/* Member email */}
                {isMember && customer.email && (
                  <div className="pt-2">
                    <p className="text-[10px] text-gray-500 truncate italic">{customer.email}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {selectedCustomer && (
        <CustomerDetailsDialog
          customer={selectedCustomer}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          showActions={showActions}
        />
      )}

      {pointsHistoryCustomer && (
        <PointsHistoryDialog
          customerId={pointsHistoryCustomer.id}
          customerName={pointsHistoryCustomer.name}
          currentPoints={pointsHistoryCustomer.points}
          open={pointsHistoryOpen}
          onOpenChange={setPointsHistoryOpen}
        />
      )}
    </>
  );
}