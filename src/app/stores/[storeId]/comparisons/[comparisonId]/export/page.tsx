import { redirect } from "next/navigation";

import { comparisonStaticParams } from "@/services/comparison";

export async function generateStaticParams() {
  return comparisonStaticParams();
}

/** Export moved to the Export menu in the header. Old links land on Data quality (method and history). */
export default async function ComparisonExportRedirect(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/export">) {
  const { storeId, comparisonId } = await props.params;
  redirect(`/stores/${storeId}/comparisons/${comparisonId}/quality`);
}
