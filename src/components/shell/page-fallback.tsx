import { Skeleton, SkeletonCard } from "@/components/ui/feedback";

/**
 * Placeholder shown while a route reads its URL params. Keeping `params` behind a Suspense boundary
 * lets Next.js reuse one App Shell for every link to the same route (instant navigation).
 */
export function PageFallback() {
  return (
    <div aria-busy="true" aria-label="Loading page" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3.5 w-80" />
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
