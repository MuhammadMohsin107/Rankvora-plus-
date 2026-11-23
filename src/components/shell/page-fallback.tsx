import { Skeleton, SkeletonCard } from "@/components/ui/feedback";

/**
 * Placeholder shown while a route reads its URL params. Keeping `params` behind a Suspense boundary
 * lets Next.js reuse one App Shell for every link to the same route (instant navigation).
 * Shape: page title, a row of metric cards, one content card, so the swap to real content shifts little.
 */
export function PageFallback() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading page" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
      <SkeletonCard lines={6} />
    </div>
  );
}
