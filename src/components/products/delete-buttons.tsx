'use client';

import { deleteProductAction, deleteVariantAction } from '@/actions/products';
import { DeleteConfirmDialog } from '@/components/delete-confirm-dialog';

interface ProductDeleteButtonProps {
  productId: string;
}

export function ProductDeleteButton({ productId }: ProductDeleteButtonProps) {
  return (
    <DeleteConfirmDialog
      title="Hapus Produk"
      description="Apakah Anda yakin ingin menghapus produk ini? Semua varian akan terhapus juga."
      onConfirm={async () => await deleteProductAction(productId)}
    />
  );
}

interface VariantDeleteButtonProps {
  variantId: string;
}

export function VariantDeleteButton({ variantId }: VariantDeleteButtonProps) {
  return (
    <DeleteConfirmDialog
      title="Hapus Varian"
      description="Apakah Anda yakin ingin menghapus varian ini?"
      onConfirm={async () => await deleteVariantAction(variantId)}
    />
  );
}
