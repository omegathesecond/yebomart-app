import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  suffix?: string;
  inputSize?: 'sm' | 'md' | 'lg';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ 
    label, 
    error, 
    hint, 
    icon,
    leftIcon, 
    rightIcon,
    suffix,
    inputSize = 'md',
    className, 
    ...props 
  }, ref) => {
    const sizes = {
      sm: 'py-2 text-sm',
      md: 'py-3',
      lg: 'py-4 text-lg'
    };

    const effectiveLeftIcon = leftIcon || icon;

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-body mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {effectiveLeftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-mute">
              {effectiveLeftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={clsx(
              'input',
              sizes[inputSize],
              effectiveLeftIcon && 'pl-10',
              (rightIcon || suffix) && 'pr-10',
              error && 'border-bad focus:border-bad focus:ring-bad/20',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-mute">
              {rightIcon}
            </div>
          )}
          {suffix && !rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-mute text-sm">
              {suffix}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-bad">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-sm text-mist">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Select component
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-body mb-1.5">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={clsx(
            'select',
            error && 'border-bad focus:border-bad focus:ring-bad/20',
            className
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-1.5 text-sm text-bad">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

// Textarea component
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-body mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={clsx(
            'input min-h-[100px] resize-none',
            error && 'border-bad focus:border-bad focus:ring-bad/20',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-bad">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
