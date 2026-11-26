import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { CreatePrompt } from "@/features/prompts/create-prompt";
import { storeIds } from "@/services/core";
import { getNewPromptData } from "@/services/prompts";

export const metadata: Metadata = { title: "New prompt" };

export async function generateStaticParams() {
  return storeIds();
}

async function NewPromptPageContent(props: PageProps<"/stores/[storeId]/prompts/new">) {
  const { storeId } = await props.params;
  const data = await getNewPromptData(storeId);
  return (
    <>
      <PageHeader title="New prompt" />
      <CreatePrompt data={data} />
    </>
  );
}

export default function NewPromptPage(props: PageProps<"/stores/[storeId]/prompts/new">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <NewPromptPageContent {...props} />
    </Suspense>
  );
}
