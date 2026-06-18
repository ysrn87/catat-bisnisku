'use client';

import { useState } from 'react';
import { AddCustomerMenu } from '@/components/customers/add-customer-menu';
import { NonMemberDialog } from '@/components/customers/non-member-dialog';
import { CustomerDialog } from '@/components/customers/customer-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, UserPlus, Users } from 'lucide-react';

interface CustomerActionsProps {
  isAdmin: boolean;
}

const FAB_BTN_CLASS = `
  sm:hidden fixed bottom-24 right-6 z-50
  w-12 h-12 rounded-full bg-[#00a090] text-white shadow-lg
  flex items-center justify-center
  hover:bg-[#007868] active:scale-95 transition-all
`.trim();

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
    viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export function CustomerActions({ isAdmin }: CustomerActionsProps) {
  const [nonMemberOpen, setNonMemberOpen] = useState(false);
  const [memberOpen, setMemberOpen]       = useState(false);

  if (isAdmin) {
    return (
      <>
        {/* Dialogs — satu instance masing-masing, dikontrol state */}
        <NonMemberDialog mode="create" open={nonMemberOpen} onOpenChange={setNonMemberOpen} trigger={null} />
        <CustomerDialog  mode="create" open={memberOpen}    onOpenChange={setMemberOpen}    trigger={null} />

        {/* Desktop — pakai AddCustomerMenu yang sudah ada */}
        <div className="hidden sm:block">
          <AddCustomerMenu />
        </div>

        {/* Mobile FAB — dropdown sederhana untuk pilih tipe */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Tambah Pelanggan" className={FAB_BTN_CLASS}>
              <PlusIcon />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-48 mb-2">
            <DropdownMenuItem onClick={() => setMemberOpen(true)} className="gap-2 cursor-pointer">
              <UserPlus className="w-4 h-4 text-[#00a090]" />
              Tambah Member
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setNonMemberOpen(true)} className="gap-2 cursor-pointer">
              <Users className="w-4 h-4 text-gray-500" />
              Tambah Non-Member
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }

  // Manager — hanya bisa tambah non-member
  return (
    <NonMemberDialog
      mode="create"
      trigger={
        <>
          <Button className="hidden sm:inline-flex bg-[#00a090] hover:bg-[#007868] text-white shadow-sm">
            <Plus className="w-4 h-4 mr-2" />
            Tambah Non-Member
          </Button>
          <button type="button" aria-label="Tambah Non-Member" className={FAB_BTN_CLASS}>
            <PlusIcon />
          </button>
        </>
      }
    />
  );
}
