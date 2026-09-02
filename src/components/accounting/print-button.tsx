'use client';

import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export function PrintButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 text-xs"
      onClick={() => window.print()}
    >
      <Printer className="w-3.5 h-3.5" />
      Cetak / Save PDF
    </Button>
  );
}
