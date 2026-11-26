import type { Metadata } from "next";

import { NotAvailablePage } from "@/components/shell/not-available";

export const metadata: Metadata = { title: "Alerts" };

export default function Page() {
  return <NotAvailablePage title="Alerts" icon="monitoring" />;
}
