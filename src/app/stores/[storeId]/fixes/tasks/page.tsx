import type { Metadata } from "next";

import { NotAvailablePage } from "@/components/shell/not-available";

export const metadata: Metadata = { title: "Fix tasks" };

export default function Page() {
  return <NotAvailablePage title="Fix tasks" icon="fixes" />;
}
