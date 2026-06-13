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
import { CustomerDialog } from '@/components/customers/customer-dialog';
import { ChevronDown, Plus, UserCheck, UserPlus } from 'lucide-react';

interface AddCustomerMenuProps {
  trigger?: React.ReactNode;
}

export function AddCustomerMenu({ trigger }: AddCustomerMenuProps) {
  const [nonMemberOpen, setNonMemberOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);

  const defaultTrigger = (
    <Button className="bg-[#028697] hover:bg-[#027080] shadow-sm">
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

        <DropdownMenuContent align="end" className="w-56 p-1.5">
          <DropdownMenuItem
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer focus:bg-gray-50"
            onSelect={() => setNonMemberOpen(true)}
          >
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#028697]/10 flex items-center justify-center">
              <UserPlus className="w-3.5 h-3.5 text-[#028697]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 leading-tight">Non-Member</p>
              <p className="text-[11px] text-gray-400 leading-tight mt-0.5">Pelanggan biasa, tanpa akun</p>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer focus:bg-gray-50 mt-0.5"
            onSelect={() => setMemberOpen(true)}
          >
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 leading-tight">Member</p>
              <p className="text-[11px] text-gray-400 leading-tight mt-0.5">Punya akun, kumpulkan poin</p>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs — controlled from here, triggered after dropdown closes */}
      <NonMemberDialog
        mode="create"
        trigger={<span />}
        open={nonMemberOpen}
        onOpenChange={setNonMemberOpen}
      />
      <CustomerDialog
        mode="create"
        trigger={<span />}
        open={memberOpen}
        onOpenChange={setMemberOpen}
      />
    </>
  );
}
