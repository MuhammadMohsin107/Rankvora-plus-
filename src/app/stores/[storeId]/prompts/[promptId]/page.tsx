import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PromptDetail } from "@/features/prompts/prompt-detail";
import { getPromptDetail, promptStaticParams } from "@/services/prompts";

export const metadata: Metadata = { title: "Prompt" };

export async function generateStaticParams() {
  return promptStaticParams();
}

async function PromptDetailPageContent(props: PageProps<"/stores/[storeId]/prompts/[promptId]">) {
  const { storeId, promptId } = await props.params;
  const data = await getPromptDetail(storeId, promptId);
  if (!data) notFound();
  return <PromptDetail data={data} />;
}

export default function PromptDetailPage(props: PageProps<"/stores/[storeId]/prompts/[promptId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <PromptDetailPageContent {...props} />
    </Suspense>
  );
}
