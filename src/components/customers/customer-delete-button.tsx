'use client';

import { deleteCustomerAction } from '@/actions/members';
import { DeleteConfirmDialog } from '@/components/delete-confirm-dialog';

interface CustomerDeleteButtonProps {
  customerId: string;
  onSuccess?: () => void;
}

export function CustomerDeleteButton({ customerId, onSuccess }: CustomerDeleteButtonProps) {
  const handleDelete = async () => {
    const result = await deleteCustomerAction(customerId);
    if (result.success && onSuccess) {
      onSuccess();
    }
    return result;
  };

  return (
    <DeleteConfirmDialog
      title="Hapus Member"
      description="Yakin ingin menghapus member ini? Member tidak akan terhapus jika pernah melakukan transaksi."
      onConfirm={handleDelete}
    />
  );
}
