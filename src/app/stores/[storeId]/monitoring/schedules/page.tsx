import type { Metadata } from "next";

import { NotAvailablePage } from "@/components/shell/not-available";

export const metadata: Metadata = { title: "Schedules" };

export default function Page() {
  return <NotAvailablePage title="Schedules" icon="monitoring" />;
}
