import type { Metadata } from "next";

import { NotAvailablePage } from "@/components/shell/not-available";

export const metadata: Metadata = { title: "Fix history" };

export default function Page() {
  return <NotAvailablePage title="Fix history" icon="fixes" />;
}
