'use client';

import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { NonMemberDialog } from '@/components/customers/non-member-dialog';
import { LinkMemberDialog } from '@/components/customers/link-member-dialog';
import { ChevronDown, Link2, Plus, UserPlus } from 'lucide-react';
import { useParams } from 'next/navigation';

interface AddCustomerMenuProps {
  trigger?: React.ReactNode;
}

export function AddCustomerMenu({ trigger }: AddCustomerMenuProps) {
  const [nonMemberOpen, setNonMemberOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const params = useParams();
  const storeSlug = typeof params?.slug === 'string' ? params.slug : undefined;

  const defaultTrigger = (
    <Button className="bg-[#028697] hover:bg-[#017585] shadow-sm">
      <Plus className="w-4 h-4 mr-2" />
      Tambah Pelanggan
      <ChevronDown className="w-3.5 h-3.5 ml-2 opacity-70" />
    </Button>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger || defaultTrigger}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60 p-1.5">
          <DropdownMenuItem
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer focus:bg-gray-50"
            onSelect={() => setNonMemberOpen(true)}
          >
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#028697]/10 flex items-center justify-center">
              <UserPlus className="w-3.5 h-3.5 text-[#028697]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 leading-tight">Tambah Customer</p>
              <p className="text-[11px] text-gray-400 leading-tight mt-0.5">Catat nama & HP, tanpa akun</p>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer focus:bg-gray-50 mt-0.5"
            onSelect={() => setMemberOpen(true)}
          >
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <Link2 className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 leading-tight">Tautkan Akun Member</p>
              <p className="text-[11px] text-gray-400 leading-tight mt-0.5">Hubungkan akun yang sudah ada</p>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NonMemberDialog
        mode="create"
        trigger={<span />}
        open={nonMemberOpen}
        onOpenChange={setNonMemberOpen}
      />
      <LinkMemberDialog
        open={memberOpen}
        onOpenChange={setMemberOpen}
        storeSlug={storeSlug}
      />
    </>
  );
}
