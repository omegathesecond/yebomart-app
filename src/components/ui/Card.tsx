import type { ReactNode } from 'react';
import { clsx } from 'clsx';

export interface CardProps {
  children: ReactNode;
  className?: string;
  gradient?: 'blue' | 'emerald' | 'amber' | 'purple' | 'red';
  hover?: boolean;
  padding?: string;
  onClick?: () => void;
}

export function Card({ children, className, gradient, hover, padding, onClick }: CardProps) {
  const gradientStyles = {
    blue: 'border-line-strong/30 bg-sand to-transparent',
    emerald: 'border-ok/30 bg-ok to-transparent',
    amber: 'border-ink/30 bg-brand to-transparent',
    purple: 'border-ink/30 bg-ink to-transparent',
    red: 'border-bad/30 bg-bad to-transparent'
  };

  return (
    <div
      className={clsx(
        'card',
        gradient && gradientStyles[gradient],
        hover && 'card-hover cursor-pointer',
        onClick && 'cursor-pointer',
        padding,
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        {subtitle && <p className="text-sm text-mute mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
