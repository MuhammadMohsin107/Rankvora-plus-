import type { Metadata } from "next";

import { NotAvailablePage } from "@/components/shell/not-available";

export const metadata: Metadata = { title: "Monitoring usage" };

export default function Page() {
  return <NotAvailablePage title="Monitoring usage" icon="monitoring" />;
}
