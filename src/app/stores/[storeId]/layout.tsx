import { notFound } from "next/navigation";

import { getStore, storeIds } from "@/services/core";

// Cache Components: route params must be known at build time (or wrapped in Suspense).
export async function generateStaticParams() {
  return storeIds();
}

export default async function StoreLayout({ children, params }: LayoutProps<"/stores/[storeId]">) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  if (!store) notFound();
  return children;
}
