import {
  BanknotesIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  WalletIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';
import type { PaymentMethod } from '@/types';

/**
 * Payment methods used to carry an emoji in PAYMENT_METHODS (`icon: '💵'`).
 * Emoji render differently on every till — a shopkeeper's Android tablet, a
 * Windows browser and an iPad each draw their own — and they cannot take the
 * brand colour. These are stroke icons on the same 24px grid as the rest.
 */
const ICONS: Record<PaymentMethod, typeof BanknotesIcon> = {
  cash: BanknotesIcon,
  card: CreditCardIcon,
  momo: DevicePhoneMobileIcon,
  emali: WalletIcon,
  credit: BookOpenIcon,
};

export function PaymentMethodIcon({
  method,
  className = 'h-5 w-5',
}: {
  method: PaymentMethod;
  className?: string;
}) {
  const Icon = ICONS[method] ?? BanknotesIcon;
  return <Icon className={className} aria-hidden="true" />;
}
