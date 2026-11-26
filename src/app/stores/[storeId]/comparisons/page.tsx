import type { Metadata } from "next";

import { NotAvailablePage } from "@/components/shell/not-available";

export const metadata: Metadata = { title: "Comparison" };

export default function Page() {
  return <NotAvailablePage title="Comparison" icon="compare" />;
}
