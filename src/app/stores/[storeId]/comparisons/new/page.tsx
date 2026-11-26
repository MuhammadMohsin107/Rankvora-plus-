import type { Metadata } from "next";

import { NotAvailablePage } from "@/components/shell/not-available";

export const metadata: Metadata = { title: "New comparison" };

export default function Page() {
  return <NotAvailablePage title="New comparison" icon="compare" />;
}
