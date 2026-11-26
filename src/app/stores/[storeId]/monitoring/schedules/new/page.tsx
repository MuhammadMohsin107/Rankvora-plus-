import type { Metadata } from "next";

import { NotAvailablePage } from "@/components/shell/not-available";

export const metadata: Metadata = { title: "New schedule" };

export default function Page() {
  return <NotAvailablePage title="New schedule" icon="monitoring" />;
}
