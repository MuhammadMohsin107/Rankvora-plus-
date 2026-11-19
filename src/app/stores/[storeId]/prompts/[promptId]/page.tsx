import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PromptDetail } from "@/features/prompts/prompt-detail";
import { getPromptDetail, promptStaticParams } from "@/services/prompts";

export const metadata: Metadata = { title: "Prompt" };

export async function generateStaticParams() {
  return promptStaticParams();
}

export default async function PromptDetailPage(props: PageProps<"/stores/[storeId]/prompts/[promptId]">) {
  const { storeId, promptId } = await props.params;
  const data = await getPromptDetail(storeId, promptId);
  if (!data) notFound();
  return <PromptDetail data={data} />;
}
