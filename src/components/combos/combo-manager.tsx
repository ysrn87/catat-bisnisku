'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { deleteComboAction, toggleComboActiveAction, type AdminCombo, type ComboFormProduct } from '@/actions/combos';
import { formatCurrency } from '@/lib/utils';
import { ComboFormDialog } from './combo-form-dialog';

interface Props {
  combos:   AdminCombo[];
  products: ComboFormProduct[];
}

export function ComboManager({ combos, products }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  const [formOpen, setFormOpen]   = useState(false);
  const [editing, setEditing]     = useState<AdminCombo | null>(null);
  const [formKey, setFormKey]     = useState(0);
  const [toDelete, setToDelete]   = useState<AdminCombo | null>(null);
  const [deleting, setDeleting]   = useState(false);

  const openForm = (combo: AdminCombo | null) => {
    setEditing(combo);
    setFormKey((k) => k + 1); // remount → state form segar
    setFormOpen(true);
  };

  const toggle = (combo: AdminCombo, next: boolean) => {
    startTransition(async () => {
      const res = await toggleComboActiveAction(combo.id, next);
      if (!res.success) toast({ title: 'Gagal', description: res.error, variant: 'destructive' });
      router.refresh();
    });
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const res = await deleteComboAction(toDelete.id);
    setDeleting(false);
    if (res.success) {
      toast({ title: 'Paket dihapus', description: toDelete.name });
      setToDelete(null);
      router.refresh();
    } else {
      toast({ title: 'Gagal', description: res.error, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Paket menggabungkan beberapa varian produk dengan satu harga. Kasir memilih isinya saat transaksi.
        </p>
        <Button onClick={() => openForm(null)} disabled={products.length === 0} className="bg-[#028697] text-white hover:bg-[#017585]">
          <Plus className="mr-1.5 h-4 w-4" /> Buat Paket
        </Button>
      </div>

      {products.length === 0 && (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Belum ada produk aktif dengan varian. Tambahkan produk terlebih dahulu.
        </div>
      )}

      {products.length > 0 && combos.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
          <Layers className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">Belum ada paket</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Contoh: “Paket Ayam” Rp15.000 berisi pilihan nasi, lauk, sayur, dan minum.
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {combos.map((combo) => (
          <div key={combo.id} className={`rounded-xl border bg-card p-4 ${combo.isActive ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{combo.name}</h3>
                <p className="text-sm font-bold text-[#028697]">{formatCurrency(combo.price)}</p>
              </div>
              <Switch checked={combo.isActive} onCheckedChange={(v) => toggle(combo, v)} aria-label={`Aktifkan ${combo.name}`} />
            </div>

            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {combo.slots.map((s) => (
                <li key={s.id} className="flex flex-wrap gap-x-1">
                  <span className="font-medium text-foreground">{s.productName}</span>
                  <span>
                    {s.variants.length === 1 ? `· ${s.variants[0].name}` : `· pilih 1 dari ${s.variants.length}`}
                    {!s.isRequired && ' · opsional'}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => openForm(combo)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Ubah
              </Button>
              <Button variant="outline" size="sm" onClick={() => setToDelete(combo)} className="text-red-600 hover:text-red-700">
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus
              </Button>
            </div>
          </div>
        ))}
      </div>

      <ComboFormDialog key={formKey} open={formOpen} onOpenChange={setFormOpen} combo={editing} products={products} />

      <Dialog open={!!toDelete} onOpenChange={(v) => !deleting && !v && setToDelete(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Hapus paket?</DialogTitle>
            <DialogDescription>
              “{toDelete?.name}” tidak akan muncul lagi di kasir. Riwayat transaksi yang sudah memakai paket ini tetap tersimpan.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>Batal</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Hapus'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
