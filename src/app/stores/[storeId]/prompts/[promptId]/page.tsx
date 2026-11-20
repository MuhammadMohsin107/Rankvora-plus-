import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";

import { PromptDetail } from "@/features/prompts/prompt-detail";
import { getPromptDetail, promptStaticParams } from "@/services/prompts";

export const metadata: Metadata = { title: "Prompt" };

export async function generateStaticParams() {
  return promptStaticParams();
}

/**
 * Ids that are not in the static list (prompts created in this browser) never 404 here: the server returns the
 * website context with `prompt: null` and the client component finds the prompt in the local demo state.
 */
async function PromptDetailPageContent(props: PageProps<"/stores/[storeId]/prompts/[promptId]">) {
  const { storeId, promptId } = await props.params;
  const data = await getPromptDetail(storeId, promptId);
  return <PromptDetail data={data} promptId={promptId} />;
}

export default function PromptDetailPage(props: PageProps<"/stores/[storeId]/prompts/[promptId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <PromptDetailPageContent {...props} />
    </Suspense>
  );
}
