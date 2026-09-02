'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Account {
  code: string;
  name: string;
}

interface LedgerAccountFilterProps {
  accounts:       Account[];
  currentAccount?: string;
}

export function LedgerAccountFilter({ accounts, currentAccount }: LedgerAccountFilterProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const onChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('account');
    } else {
      params.set('account', value);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-3">
      <Label className="text-xs text-muted-foreground whitespace-nowrap">Filter Akun</Label>
      <Select value={currentAccount ?? 'all'} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs w-56">
          <SelectValue placeholder="Semua Akun" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">Semua Akun</SelectItem>
          {accounts.map((acc) => (
            <SelectItem key={acc.code} value={acc.code} className="text-xs font-mono">
              {acc.code} – {acc.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
