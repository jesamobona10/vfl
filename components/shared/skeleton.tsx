import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-surface-2", className)} {...props} />;
}

export { Skeleton };

function DashboardPattern() {
  return (
    <div className="flex h-80 w-full max-w-2xl overflow-hidden rounded-xl border">
      <div className="flex w-48 shrink-0 flex-col gap-1 border-r bg-muted/30 p-3">
        <div className="mb-2 flex items-center gap-2 px-1 py-1">
          <Skeleton className="size-6 rounded-md" />
          <Skeleton className="h-4 w-20" />
        </div>

        {[60, 44, 52, 36].map((w, i) => (
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5" key={i}>
            <Skeleton className="size-4 rounded-sm" />
            <Skeleton
              className={`h-3.5 w-${w === 60 ? "full" : `[${w}%]`}`}
              style={{ width: `${w}%` }}
            />
          </div>
        ))}

        <div className="mt-3 border-t pt-3">
          {[48, 56].map((w, i) => (
            <div className="flex items-center gap-2 rounded-md px-2 py-1.5" key={i}>
              <Skeleton className="size-4 rounded-sm" />
              <Skeleton className="h-3.5" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>

        <div className="mt-auto flex items-center gap-2 px-2 py-1.5">
          <Skeleton className="size-7 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <Skeleton className="h-5 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-20 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        </div>

        <div className="flex-1 space-y-4 p-5">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div className="space-y-2 rounded-lg border p-3" key={i}>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5" key={i}>
                <Skeleton className="size-8 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted" role="status" aria-live="polite">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand-600" aria-hidden="true" />
      <span>{label}...</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-text">{title}</p>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`card p-4 space-y-3 ${className}`}>
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton
              key={j}
              className={`h-4 ${j === 0 ? "w-1/3" : j === cols - 1 ? "w-1/6" : "w-1/5"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ items = 4 }: { items?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="w-8 h-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonForm({ fields = 3 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-1/6" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-9 w-24" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex items-center justify-center py-10">
      <DashboardPattern />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5 space-y-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

export function AdminPanelSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2 border-b border-line pb-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
      <PageSkeleton />
    </div>
  );
}
