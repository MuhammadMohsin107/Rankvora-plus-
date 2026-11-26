import type { Metadata } from "next";

import { NotAvailablePage } from "@/components/shell/not-available";

export const metadata: Metadata = { title: "New prompt" };

export default function Page() {
  return <NotAvailablePage title="New prompt" icon="prompts" />;
}
