'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="items-center justify-between px-2 py-4 text-[10px] sm:text-sm">

      <div className='flex justify-between'>
        <div>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="w-14 h-7 text-[11px] sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="40">40</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className='h-7 w-4'
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <p>
            Halaman {currentPage} dari {totalPages}
          </p>
          <Button
            variant="outline"
            className='h-7 w-4'
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className='flex justify-between'>
        <div className="items-center gap-1">
          <p className="text-muted-foreground pt-1">
            Baris data
          </p>
        </div>
        <div className="items-center gap-1">
          <p className="text-muted-foreground pt-1">
            {startItem} - {endItem} dari {totalItems} data
          </p>
        </div>
      </div>
    </div>
  );
}
