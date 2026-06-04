import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export type ToastType = 'success' | 'error';

export interface ToastState {
  message: string;
  type: ToastType;
}

/**
 * Lightweight toast state hook. Pair with <Toast /> for the surface.
 *
 * Failures must be loud: call `showToast(msg, 'error')` whenever an API call
 * fails — never swallow the error or fall back to fake data.
 */
export function useToast(autoDismissMs = 4000) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), autoDismissMs);
    return () => clearTimeout(timer);
  }, [toast, autoDismissMs]);

  return { toast, showToast, dismissToast };
}

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
        className="p-1 rounded-lg hover:bg-white/20 transition-colors"
        aria-label="Dismiss"
      >
        <XMarkIcon className="w-5 h-5" />
      </button>
    </div>
  );
}
