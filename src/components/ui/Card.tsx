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
    blue: 'border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-transparent',
    emerald: 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent',
    amber: 'border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent',
    purple: 'border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-transparent',
    red: 'border-red-500/30 bg-gradient-to-br from-red-500/10 to-transparent'
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
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
