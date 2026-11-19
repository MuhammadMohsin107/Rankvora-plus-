import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import { notFound } from "next/navigation";

import { getStore, storeIds } from "@/services/core";

// Cache Components: route params must be known at build time (or wrapped in Suspense).
export async function generateStaticParams() {
  return storeIds();
}

async function StoreLayoutContent({ children, params }: LayoutProps<"/stores/[storeId]">) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  if (!store) notFound();
  return children;
}

export default function StoreLayout(props: LayoutProps<"/stores/[storeId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <StoreLayoutContent {...props} />
    </Suspense>
  );
}
