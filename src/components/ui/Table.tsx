import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  isLoading?: boolean;
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  onRowClick,
  emptyMessage = 'Nothing here yet',
  isLoading
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-shade border-t-brand" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-mist">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-line-strong">
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  'eyebrow px-4 pb-2.5 pt-3 text-left',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.map((item) => (
            <tr
              key={String(item[keyField])}
              onClick={() => onRowClick?.(item)}
              className={clsx(
                'transition-colors',
                onRowClick && 'cursor-pointer hover:bg-sand'
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={clsx('px-4 py-3.5 text-[13.5px]', col.className)}
                >
                  {col.render ? col.render(item) : String(item[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
