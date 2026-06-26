'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { NonMemberDialog } from '@/components/customers/non-member-dialog';
import { LinkMemberDialog } from '@/components/customers/link-member-dialog';
import { AddCustomerMenu } from '@/components/customers/add-customer-menu';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link2, Plus, UserPlus } from 'lucide-react';

interface CustomerActionsProps {
  isAdmin: boolean;
}

const FAB_BTN_CLASS = `
  sm:hidden fixed bottom-24 right-6 z-50
  w-12 h-12 rounded-full bg-[#028697] text-white shadow-lg
  flex items-center justify-center
  hover:bg-[#017585] active:scale-95 transition-all
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
  const [memberOpen, setMemberOpen] = useState(false);
  const params = useParams();
  const storeSlug = typeof params?.slug === 'string' ? params.slug : undefined;

  if (isAdmin) {
    return (
      <>
        <NonMemberDialog mode="create" open={nonMemberOpen} onOpenChange={setNonMemberOpen} trigger={null} />
        <LinkMemberDialog open={memberOpen} onOpenChange={setMemberOpen} storeSlug={storeSlug} />

        {/* Desktop */}
        <div className="hidden sm:block">
          <AddCustomerMenu />
        </div>

        {/* Mobile FAB */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Tambah Pelanggan" className={FAB_BTN_CLASS}>
              <PlusIcon />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-52 mb-2">
            <DropdownMenuItem onClick={() => setMemberOpen(true)} className="gap-2 cursor-pointer">
              <Link2 className="w-4 h-4 text-blue-600" />
              Tautkan Akun Member
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setNonMemberOpen(true)} className="gap-2 cursor-pointer">
              <UserPlus className="w-4 h-4 text-[#028697]" />
              Tambah Customer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }

  // Manager — hanya bisa tambah customer (non-member)
  return (
    <>
      <NonMemberDialog mode="create" open={nonMemberOpen} onOpenChange={setNonMemberOpen} trigger={null} />

      <Button
        className="hidden sm:inline-flex bg-[#028697] hover:bg-[#017585] text-white shadow-sm"
        onClick={() => setNonMemberOpen(true)}
      >
        <Plus className="w-4 h-4 mr-2" />
        Tambah Customer
      </Button>
      <button
        type="button"
        aria-label="Tambah Customer"
        className={FAB_BTN_CLASS}
        onClick={() => setNonMemberOpen(true)}
      >
        <PlusIcon />
      </button>
    </>
  );
}
