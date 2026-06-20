'use client';

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { createCategoryAction, updateCategoryAction } from '@/actions/categories';
import { Tag, Loader2, Plus, Pencil } from 'lucide-react';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#10b981', '#028697', '#06b6d4', '#3b82f6',
  '#8b5cf6', '#ec4899', '#6b7280', '#292524',
];

const PRESET_ICONS = [
  '🍔', '🍜', '🍕', '🥩', '🥗', '🍰',
  '☕', '🧃', '🛍️', '👕', '💄', '📦',
  '🔧', '💊', '📱', '🏠', '🌿', '⭐',
];

interface CategoryDialogProps {
  mode: 'create' | 'edit';
  category?: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function CategoryDialog({
  mode, category, open: controlledOpen,
  onOpenChange, onSuccess, trigger,
}: CategoryDialogProps) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen! : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };

  const [name, setName]   = useState('');
  const [color, setColor] = useState('#028697');
  const [icon, setIcon]   = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const isCreate = mode === 'create';

  useEffect(() => {
    if (open) {
      setName(category?.name ?? '');
      setColor(category?.color ?? '#028697');
      setIcon(category?.icon ?? '');
    }
  }, [open, category]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.set('name', name);
    formData.set('color', color);
    formData.set('icon', icon);

    const result = isCreate
      ? await createCategoryAction(formData)
      : await updateCategoryAction(category!.id, formData);

    if (result.success) {
      toast({
        title: isCreate ? 'Kategori berhasil dibuat!' : 'Kategori diperbarui!',
      });
      setOpen(false);
      onSuccess?.();
    } else {
      toast({ title: 'Gagal', description: result.error, variant: 'destructive' });
    }
    setLoading(false);
  }

  return (
    <>
      {/* Custom trigger */}
      {trigger && (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#028697]" />
              {isCreate ? 'Tambah Kategori' : 'Edit Kategori'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">

            {/* Preview */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                style={{ backgroundColor: color + '20', border: `2px solid ${color}` }}
              >
                {icon || <Tag className="w-4 h-4" style={{ color }} />}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color }}>
                  {name || 'Nama Kategori'}
                </p>
                <p className="text-xs text-gray-400">Preview kategori</p>
              </div>
            </div>

            {/* Nama */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Nama Kategori <span className="text-red-500">*</span>
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Makanan, Minuman, Elektronik"
                maxLength={50}
                required
                disabled={loading}
                className="h-9 text-sm"
              />
              <p className="text-right text-[10px] text-gray-400">{name.length}/50</p>
            </div>

            {/* Icon */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Ikon (emoji)</Label>
              <div className="flex gap-2">
                <Input
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="Pilih atau ketik emoji"
                  maxLength={4}
                  disabled={loading}
                  className="h-9 text-sm w-32 text-center text-lg"
                />
                <div className="flex flex-wrap gap-1 flex-1">
                  {PRESET_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setIcon(icon === emoji ? '' : emoji)}
                      className={`w-7 h-7 text-sm rounded flex items-center justify-center hover:bg-gray-100 transition-colors ${
                        icon === emoji ? 'bg-gray-200 ring-1 ring-gray-400' : ''
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Warna */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Warna</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-9 h-9 rounded cursor-pointer border border-gray-200"
                  title="Pilih warna"
                />
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                        color === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                type="button" variant="outline" onClick={() => setOpen(false)}
                disabled={loading} className="flex-1"
              >
                Batal
              </Button>
              <Button
                type="submit" disabled={loading}
                className="flex-1 bg-[#028697] hover:bg-[#017585] text-white"
              >
                {loading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Menyimpan...</>
                  : isCreate
                  ? <><Plus className="w-3.5 h-3.5 mr-1.5" />Buat Kategori</>
                  : <><Pencil className="w-3.5 h-3.5 mr-1.5" />Simpan</>
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
