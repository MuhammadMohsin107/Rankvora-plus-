import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { PromptLibrary } from "@/features/prompts/prompt-library";
import { pluralize } from "@/lib/format";
import { storeIds } from "@/services/core";
import { getLibrary } from "@/services/prompts";

export const metadata: Metadata = { title: "Prompts" };

export async function generateStaticParams() {
  return storeIds();
}

export default async function PromptsPage(props: PageProps<"/stores/[storeId]/prompts">) {
  const { storeId } = await props.params;
  const data = await getLibrary(storeId);
  if (!data) notFound();

  if (data.prompts.length === 0) {
    return (
      <>
        <PageHeader title="Prompts" />
        <EmptyState
          icon="prompts"
          title="No prompts yet"
          description="Prompts are the questions customers ask AI. Add the first one to start tracking."
          action={
            <ButtonLink href={`/stores/${storeId}/prompts/new`} variant="primary" icon="plus">
              New prompt
            </ButtonLink>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Prompts"
        subtitle={`${pluralize(data.prompts.length, "prompt")} · ${data.store.marketName}`}
        actions={
          <ButtonLink href={`/stores/${storeId}/prompts/new`} variant="primary" icon="plus">
            New prompt
          </ButtonLink>
        }
      />
      <PromptLibrary store={data.store} initialPrompts={data.prompts} initialGroups={data.groups} />
    </>
  );
}
