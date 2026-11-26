import type { Metadata } from "next";

import { NotAvailablePage } from "@/components/shell/not-available";

export const metadata: Metadata = { title: "Prompt Library" };

export default function Page() {
  return <NotAvailablePage title="Prompt Library" icon="prompts" />;
}
