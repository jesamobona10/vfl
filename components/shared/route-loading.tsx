import { Skeleton, SkeletonList } from "@/components/shared/skeleton";

/**
 * Shared skeleton for route-level `loading.tsx` files. Keeps loading states
 * consistent across segments while letting each pick a shape that matches its
 * content.
 */
export function RouteLoading({
  variant = "list",
}: {
  variant?: "list" | "cards" | "table" | "form";
}) {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      {variant === "cards" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card space-y-3 p-4">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      )}
      {variant === "table" && (
        <div className="card p-4">
          <SkeletonList items={6} />
        </div>
      )}
      {variant === "form" && (
        <div className="card space-y-4 p-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      )}
      {variant === "list" && (
        <div className="card p-4">
          <SkeletonList items={6} />
        </div>
      )}
    </div>
  );
}
