import type { Metadata } from "next";

import { NotAvailablePage } from "@/components/shell/not-available";

export const metadata: Metadata = { title: "Observations" };

export default function Page() {
  return <NotAvailablePage title="Observations" icon="monitoring" />;
}
