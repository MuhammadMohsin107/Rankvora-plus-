import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";

import { PromptLibrary } from "@/features/prompts/prompt-library";
import { storeIds } from "@/services/core";
import { getLibrary } from "@/services/prompts";

export const metadata: Metadata = { title: "Prompt Library" };

export async function generateStaticParams() {
  return storeIds();
}

/**
 * Websites created in this browser are not in the static data: getLibrary then returns an unresolved
 * context and the client component fills in the website and its prompts from the local demo state.
 */
async function PromptsPageContent(props: PageProps<"/stores/[storeId]/prompts">) {
  const { storeId } = await props.params;
  const data = await getLibrary(storeId);
  return <PromptLibrary data={data} />;
}

export default function PromptsPage(props: PageProps<"/stores/[storeId]/prompts">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <PromptsPageContent {...props} />
    </Suspense>
  );
}
