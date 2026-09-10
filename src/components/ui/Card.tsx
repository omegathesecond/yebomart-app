import type { ReactNode } from 'react';
import { clsx } from 'clsx';

export interface CardProps {
  children: ReactNode;
  className?: string;
  /** Marks a card as the one that matters: a 2px brand rule on its leading edge. */
  accent?: boolean;
  hover?: boolean;
  padding?: string;
  onClick?: () => void;
}

export function Card({ children, className, accent, hover, padding, onClick }: CardProps) {
  return (
    <div
      className={clsx(
        'card',
        accent && 'border-l-2 border-l-brand',
        hover && 'cursor-pointer transition-colors hover:border-line-strong',
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
