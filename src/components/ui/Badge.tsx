import { clsx } from 'clsx';

export interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'neutral';
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export function Badge({ children, variant = 'default', size = 'md', dot, className }: BadgeProps) {
  const variants = {
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
    neutral: 'bg-shade text-body',
    default: 'bg-shade text-body'
  };

  const sizes = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2.5 py-0.5'
  };

  if (dot) {
    return (
      <span className={clsx(
        'inline-block w-2 h-2 rounded-full',
        variant === 'success' && 'bg-ok',
        variant === 'warning' && 'bg-brand',
        variant === 'danger' && 'bg-bad',
        variant === 'info' && 'bg-sand',
        (variant === 'default' || variant === 'neutral') && 'bg-mist',
        className
      )} />
    );
  }

  return (
    <span className={clsx('badge', variants[variant], sizes[size], className)}>
      {children}
    </span>
  );
}
