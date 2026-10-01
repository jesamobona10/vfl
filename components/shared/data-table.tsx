"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T, index: number) => React.ReactNode;
  /** Cell classes for the desktop table. */
  className?: string;
  /** Keep the column readable when the table scrolls sideways. */
  width?: string;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T, index: number) => string | number;
  /** Stacked card layout shown below the `lg` breakpoint. */
  mobileCard: (row: T, index: number) => React.ReactNode;
  empty?: React.ReactNode;
  className?: string;
  /** Header cell classes for the desktop table. */
  headClassName?: string;
  /** Minimum width for the table so columns do not collapse when scrolled. */
  minWidth?: number;
  /**
   * Makes a desktop row activatable, e.g. to open a detail drawer.
   *
   * Desktop only: the mobile card is caller-supplied, so it must wire its own
   * handler. Passing this alone does not make the card tappable.
   */
  onRowClick?: (row: T, index: number) => void;
}

/**
 * Renders a table on `lg` and up, and a stacked card layout below it.
 *
 * Mobile horizontal scrolling for data grids is a poor touch experience, so
 * wide tables get a purpose-built card fallback instead of relying on an
 * `overflow-x-auto` wrapper alone.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  mobileCard,
  empty,
  className,
  headClassName,
  minWidth,
  onRowClick,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <>{empty ?? DEFAULT_EMPTY}</>;
  }

  return (
    <div className={className}>
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm" style={minWidth ? { minWidth } : undefined}>
          <thead>
            <tr
              className={cn(
                "text-xs uppercase tracking-[0.04em] text-ink-3 font-semibold",
                headClassName
              )}
            >
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn("px-3 py-2.5 border-b border-line font-semibold", col.className)}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                className={cn(
                  "border-b border-line last:border-0 transition-colors",
                  onRowClick && "hover:bg-surface-2/40 cursor-pointer"
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-3 py-2.5", col.className)}>
                    {col.render(row, index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden space-y-2">
        {rows.map((row, index) => (
          <Fragment key={rowKey(row, index)}>{mobileCard(row, index)}</Fragment>
        ))}
      </div>
    </div>
  );
}

const DEFAULT_EMPTY = <p className="text-sm text-muted p-4 text-center">No records to show.</p>;

/** Label/value pair used inside mobile cards. */
export function DataField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] uppercase tracking-[0.04em] text-ink-3 font-semibold">{label}</p>
      <div className="text-sm mt-0.5 min-w-0 break-words">{children}</div>
    </div>
  );
}
