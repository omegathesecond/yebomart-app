import type { ToastState } from './useToast';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastState | null;
  onDismiss: () => void;
}) {
  if (!toast) return null;

  const Icon = toast.type === 'success' ? CheckCircleIcon : ExclamationTriangleIcon;

  return (
    <div className={`toast toast-${toast.type} flex items-center gap-3`} role="alert">
      <Icon className="w-6 h-6 shrink-0" />
      <span className="flex-1 font-medium text-sm">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="p-1 rounded-sharp hover:bg-cream/20 transition-colors"
        aria-label="Dismiss"
      >
        <XMarkIcon className="w-5 h-5" />
      </button>
    </div>
  );
}
