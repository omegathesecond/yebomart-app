import { useCallback, useEffect, useState } from 'react';
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

