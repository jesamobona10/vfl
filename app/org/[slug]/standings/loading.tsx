import { Skeleton, SkeletonTable } from "@/components/shared/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="card p-4">
        <SkeletonTable rows={8} cols={5} />
      </div>
    </div>
  );
}
