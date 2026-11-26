import type { Metadata } from "next";

import { NotAvailablePage } from "@/components/shell/not-available";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return <NotAvailablePage title="Reports" icon="reports" />;
}
