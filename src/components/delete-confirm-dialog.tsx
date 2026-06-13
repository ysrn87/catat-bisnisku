'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Trash2 } from 'lucide-react';

interface DeleteConfirmDialogProps {
  title: string;
  description: string;
  onConfirm: () => Promise<{ success: boolean; error?: string }>;
  trigger?: React.ReactNode;
}

export function DeleteConfirmDialog({ title, description, onConfirm, trigger }: DeleteConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const result = await onConfirm();
      
      if (result.success) {
        toast({
          title: 'Success!',
          description: 'Item deleted successfully.',
        });
        setOpen(false);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Gagal menghapus.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>
        {trigger || (
          <Button variant="ghost" size="sm" className="group">
            <Trash2 className="w-4 h-4 text-rose-500 group-hover:text-rose-700 transition-colors" />
          </Button>
        )}
      </div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Deleting...' : 'Hapus'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}