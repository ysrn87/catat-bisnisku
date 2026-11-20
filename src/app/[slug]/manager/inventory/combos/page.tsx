import { getComboFormProducts, getCombosForAdmin } from '@/actions/combos';
import { ComboManager } from '@/components/combos/combo-manager';

export default async function ManagerCombosPage() {
  const [combos, products] = await Promise.all([getCombosForAdmin(), getComboFormProducts()]);
  return <ComboManager combos={combos} products={products} />;
}
