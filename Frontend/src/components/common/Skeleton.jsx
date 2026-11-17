/**
 * Loading placeholders shaped like the content they stand in for, so the
 * layout does not jump when real data lands.
 */
export function Skeleton({ className = "" }) {
  return <div className={`lf-skeleton ${className}`} aria-hidden="true" />;
}

export function BusinessCardSkeleton() {
  return (
    <div className="lf-card overflow-hidden p-4" aria-hidden="true">
      <div className="flex gap-3">
        <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-9 flex-1 rounded-xl" />
        <Skeleton className="h-9 flex-1 rounded-xl" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 5, item: Item = BusinessCardSkeleton }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading results">
      {Array.from({ length: count }, (unused, index) => (
        <Item key={index} />
      ))}
      <span className="sr-only">Loading results</span>
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="lf-card p-5" aria-hidden="true">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-16" />
    </div>
  );
}

export default Skeleton;
