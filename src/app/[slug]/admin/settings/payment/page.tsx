import { getManagedPaymentAccounts } from '@/actions/payment-accounts';
import { PaymentAccountsSettings } from '@/components/settings/payment-accounts-settings';

export default async function PaymentSettingsPage() {
  const accounts = await getManagedPaymentAccounts();
  return <PaymentAccountsSettings initialAccounts={accounts} />;
}
