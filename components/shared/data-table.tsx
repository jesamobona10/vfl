"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { SkeletonCard, SkeletonTable } from "@/components/shared/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

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
  /** Show a skeleton table instead of rows while data loads. */
  loading?: boolean;
  /** Number of skeleton rows/cards rendered while loading. */
  skeletonRows?: number;
  /** Keep the header row visible while the page scrolls. */
  stickyHeader?: boolean;
  /** Keep the first column visible while the table scrolls sideways. */
  pinnedFirstColumn?: boolean;
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
  loading = false,
  skeletonRows = 5,
  stickyHeader = false,
  pinnedFirstColumn = false,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className={className}>
        <div className="hidden lg:block">
          <SkeletonTable rows={skeletonRows} cols={columns.length} />
        </div>
        <div className="lg:hidden space-y-2">
          {Array.from({ length: skeletonRows }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return <>{empty ?? DEFAULT_EMPTY}</>;
  }

  return (
    <div className={className}>
      <div
        className={cn(
          "hidden lg:block",
          stickyHeader ? "max-h-[70vh] overflow-auto" : "overflow-x-auto"
        )}
      >
        <table className="w-full text-sm" style={minWidth ? { minWidth } : undefined}>
          <thead>
            <tr
              className={cn(
                "text-xs uppercase tracking-[0.04em] text-ink-3 font-semibold",
                headClassName
              )}
            >
              {columns.map((col, colIndex) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-2.5 border-b border-line font-semibold",
                    stickyHeader && "sticky top-0 z-20 bg-surface",
                    pinnedFirstColumn && colIndex === 0 && "sticky left-0 z-30 bg-surface",
                    col.className
                  )}
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
                {columns.map((col, colIndex) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-3 py-2.5",
                      pinnedFirstColumn && colIndex === 0 && "sticky left-0 z-10 bg-surface",
                      col.className
                    )}
                  >
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

const DEFAULT_EMPTY = <EmptyState size="sm" title="No records to show" />;

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
