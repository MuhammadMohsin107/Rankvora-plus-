import type { Metadata } from "next";

import { NotAvailablePage } from "@/components/shell/not-available";

export const metadata: Metadata = { title: "Monitoring" };

export default function Page() {
  return <NotAvailablePage title="Monitoring" icon="monitoring" />;
}
