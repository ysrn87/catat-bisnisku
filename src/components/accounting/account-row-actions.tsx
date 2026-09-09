'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { AccountDialog } from './account-dialog';
import { toggleAccountActiveAction, deleteAccountAction } from '@/actions/accounts';
import { MoreHorizontal, Pencil, Trash2, EyeOff, Eye, Lock, AlertTriangle, Loader2 } from 'lucide-react';

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

interface AccountRowActionsProps {
  account: {
    id:       string;
    code:     string;
    name:     string;
    type:     AccountType;
    isSystem: boolean;
    isActive: boolean;
  };
}

export function AccountRowActions({ account }: AccountRowActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const { toast } = useToast();

  const handleToggle = async () => {
    setLoading(true);
    try {
      const result = await toggleAccountActiveAction(account.id);
      if (result.success) {
        toast({
          title:       'Berhasil',
          description: `Akun ${account.name} ${(result as any).newState ? 'diaktifkan' : 'dinonaktifkan'}.`,
        });
      } else {
        toast({ title: 'Gagal', description: (result as any).error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const result = await deleteAccountAction(account.id);
      if (result.success) {
        toast({ title: 'Berhasil', description: `Akun ${account.name} dihapus.` });
        setDeleteOpen(false);
      } else {
        toast({ title: 'Gagal', description: (result as any).error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            disabled={loading}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">

          {/* Edit */}
          <AccountDialog
            mode="edit"
            account={account}
            trigger={
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="gap-2 cursor-pointer"
              >
                {account.isSystem
                  ? <><Lock className="w-3.5 h-3.5 text-gray-400" />Edit Nama</>
                  : <><Pencil className="w-3.5 h-3.5" />Edit</>
                }
              </DropdownMenuItem>
            }
          />

          {/* Toggle aktif/nonaktif — hanya non-system */}
          {!account.isSystem && (
            <DropdownMenuItem
              onClick={handleToggle}
              disabled={loading}
              className="gap-2 cursor-pointer"
            >
              {account.isActive
                ? <><EyeOff className="w-3.5 h-3.5 text-amber-500" />Nonaktifkan</>
                : <><Eye className="w-3.5 h-3.5 text-green-600" />Aktifkan</>
              }
            </DropdownMenuItem>
          )}

          {/* Hapus — hanya non-system */}
          {!account.isSystem && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus
              </DropdownMenuItem>
            </>
          )}

        </DropdownMenuContent>
      </DropdownMenu>

      {/* Konfirmasi hapus — pakai Dialog biasa */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden border-0 shadow-2xl"
        >
          {/* Header merah */}
          <div className="bg-gradient-to-br from-red-500 to-red-700 px-6 pt-6 pb-8 relative">
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="flex items-center gap-3 relative">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <DialogHeader className="p-0 text-left space-y-0.5">
                <DialogTitle className="text-white text-lg font-semibold">Hapus Akun?</DialogTitle>
                <p className="text-white/65 text-xs">Aksi ini tidak dapat dibatalkan</p>
              </DialogHeader>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-3">
            <p className="text-sm text-gray-700">
              Akun <span className="font-semibold">{account.code} · {account.name}</span> akan dihapus permanen.
            </p>
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700">
              Akun yang sudah pernah digunakan di jurnal <strong>tidak dapat dihapus</strong> — sistem akan menolak secara otomatis.
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              disabled={loading}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <Button
              onClick={handleDelete}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white min-w-[120px]"
            >
              {loading
                ? <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Menghapus...</span>
                : <span className="flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" />Ya, Hapus</span>
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
