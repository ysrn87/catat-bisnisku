'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { toggleProductActiveAction, toggleVariantActiveAction } from '@/actions/products';

interface ActiveToggleProps {
  id: string;
  isActive: boolean;
  type: 'product' | 'variant';
}

export function ActiveToggle({ id, isActive, type }: ActiveToggleProps) {
  const [active, setActive] = useState(isActive);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleToggle = async (checked: boolean) => {
    setLoading(true);
    setActive(checked); // optimistic update
    try {
      const result =
        type === 'product'
          ? await toggleProductActiveAction(id, checked)
          : await toggleVariantActiveAction(id, checked);

      if (!result.success) {
        setActive(!checked); // revert
        toast({ title: 'Gagal', description: result.error, variant: 'destructive' });
      } else {
        toast({
          title: checked ? 'Diaktifkan' : 'Dinonaktifkan',
          description: `${type === 'product' ? 'Produk' : 'Varian'} berhasil ${checked ? 'diaktifkan' : 'dinonaktifkan'}.`,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Switch
      checked={active}
      onCheckedChange={handleToggle}
      disabled={loading}
      className="data-[state=checked]:bg-[#028697]"
    />
  );
}
